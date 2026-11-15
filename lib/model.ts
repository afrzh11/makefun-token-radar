// Token Radar: a peer-multiple model over the sealed snapshot.
//
// The board ranks every protocol that records no token and is not a wrapped, staked or bridged
// product of a token that already trades. The watchlist is the floor, never the ceiling: the board
// covers all 40 of its slugs and adds every other protocol that passes the same exclusion rule the
// watchlist itself uses, whatever its TVL.
//
// Implied value is a comparables model, computed only from the snapshot's own figures:
//
//   peer       = the median market-cap/TVL of the token-bearing protocols in the same category
//                (at least 3 peers; otherwise the median over every token-bearing protocol),
//                clamped to [0.05, 2.50]. A protocol is worth what its category's traded peers
//                are worth per dollar of TVL.
//   growth     = clamp(change_7d, -50, +100) per cent
//   growthMult = 1 + (growth / 100) x 0.5
//   maturity   = 0.70 + min(age_days, 1095) / 1095 x 0.45   (age unknown: 365 days)
//   implied    = round(tvl_usd x peer x growthMult x maturity), at least $1
//
// No protocol name is ever special-cased: the same function scores every row, and the dashboard
// shows the four factors for every row so a reader can check the arithmetic. The implied value is
// the entry's own claim, never a price and never a promise of a token.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  peer_min_peers: number;
  peer_clamp_low: number;
  peer_clamp_high: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  peer_min_peers: 3,
  peer_clamp_low: 0.05,
  peer_clamp_high: 2.5,
  growth_weight: 0.5,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.45,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-peer-1';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_multiple: number;
    peer_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** One peer-multiple table entry: a category's median, and how many peers set it. */
export interface PeerEntry {
  multiple: number;
  peers: number;
}

/** The dashboard's compact view of one row: positional, see dataScript's column note. */
export type RadarRow = [
  rank: number,
  slug: string,
  name: string,
  category: string | null,
  chains: string[],
  tvl_usd: number,
  change_7d: number | null,
  age_days: number | null,
  peer_multiple: number,
  peer_peers: number,
  growth_multiplier: number,
  maturity_multiplier: number,
  implied_value_usd: number,
  on_watchlist: boolean,
];

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export type LiveRow = [
  slug: string,
  name: string,
  category: string | null,
  chains: string[],
  tvl_usd: number,
  mcap_usd: number | null,
  change_7d: number | null,
];

/** Everything the dashboard needs: the board, the live set, the peer table and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  total_implied_usd: number;
  global_peer_multiple: number;
  peers: Record<string, PeerEntry>;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The peer-multiple table: for each category, the median market-cap/TVL of its token-bearing
 * protocols when at least `minPeers` of them exist; otherwise the median over every token-bearing
 * protocol. Every multiple is clamped to [low, high] so one frothy category cannot set the board.
 *
 * The bar is not blended away: a lone peer can be an outlier by orders of magnitude (one
 * prediction-market peer's market cap is 400x its TVL; one risk-curator peer's is 3x), and
 * blending it in would let a single unrepresentative token set its whole category — Polymarket
 * would jump to ~$915M and top the board on one peer's ratio. The global median is the honest
 * fallback, and the dashboard says so wherever a row uses it.
 */
export function peerTable(
  protocols: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { peers: Record<string, PeerEntry>; global: number } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const cat = p.category ?? 'Uncategorised';
    const list = byCategory.get(cat) ?? [];
    list.push(ratio);
    byCategory.set(cat, list);
  }
  const global = clamp(median(all), model.peer_clamp_low, model.peer_clamp_high);
  const peers: Record<string, PeerEntry> = {};
  for (const [cat, ratios] of [...byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const multiple = ratios.length >= model.peer_min_peers ? clamp(median(ratios), model.peer_clamp_low, model.peer_clamp_high) : global;
    peers[cat] = { multiple: round4(multiple), peers: ratios.length };
  }
  return { peers, global: round4(global) };
}

/** The four factors and the implied value one protocol gets under `model` and `peer`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  peer: number,
  model: ModelConstants = MODEL,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (clamp(ageForModel, 0, model.maturity_days) / model.maturity_days) * model.maturity_range;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * peer * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** An exchange's name at the start of a protocol's name. */
const EXCHANGE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * A wrapped, staked or bridged product's name: a whole word `wrapped`, `staked`, `staking`,
 * `restaking` or `restaked`. Restaking is a staked product of a token that already trades, so the
 * word belongs in the list even though the watchlist's own rule names only the first three.
 */
const WRAPPED = /\b(wrapped|staked|staking|restaking|restaked)\b/i;

/**
 * The categories the watchlist's rule excludes: bridges, liquid staking and exchanges.
 * 'Cross Chain Bridge' is DefiLlama's other bridge category: a bridge product by name, and the
 * house's watchlist keeps Circle Gateway (Circle's bridge product) out of it — via the parent
 * protocol, a field the snapshot does not carry — so the category, not the name, is excluded.
 * Without this, one bridge product would rank #14 and its farm plan would be "bridge USDC",
 * which is not farming a token launch.
 */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and passing the same exclusion rule the
 * watchlist itself uses — not a bridge, liquid-staking or exchange product, not a versioned pool,
 * not an exchange's name, and no wrapped/staked word in its name.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !EXCHANGE.test(p.name) &&
    !WRAPPED.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n and strictly falling values. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; peers: Record<string, PeerEntry>; global: number } {
  const { peers, global } = peerTable(snapshot.protocols, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other protocol that passes the same exclusion rule, whatever its TVL.
  // A protocol above the floor that passes the rule would already be on the watchlist, so the
  // early rows are all below the floor by construction.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const entry = peers[p.category ?? 'Uncategorised'];
    const peer = entry !== undefined ? entry.multiple : global;
    const peerPeers = entry !== undefined ? entry.peers : 0;
    const { implied, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, peer, model);
    return { p, peer, peerPeers, implied, growthPct, growthMult, maturityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Ranks must be a strict order: equal implied values fall by a dollar, in rank order.
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.implied >= scored[i - 1]!.implied) scored[i]!.implied = Math.max(1, scored[i - 1]!.implied - 1);
  }
  const board: BoardRow[] = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      // Full precision, unrounded: the dashboard recomputes the implied value from these
      // factors, so they must multiply to the board value exactly (up to the strict-order
      // adjustment below). Display rounds them; the record does not.
      peer_multiple: s.peer,
      peer_peers: s.peerPeers,
      growth_pct: round4(s.growthPct),
      growth_multiplier: s.growthMult,
      maturity_multiplier: s.maturityMult,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
  return { board, peers, global };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => [p.slug, p.name, p.category, p.chains, p.tvl_usd, p.mcap_usd, p.change_7d] as LiveRow);
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return [
    row.rank,
    row.slug,
    row.name,
    row.category,
    row.chains,
    row.tvl_usd,
    row.change_7d,
    row.age_days,
    row.model.peer_multiple,
    row.model.peer_peers,
    row.model.growth_multiplier,
    row.model.maturity_multiplier,
    row.implied_value_usd,
    onWatchlist,
  ];
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, peers, global } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    total_implied_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    global_peer_multiple: global,
    peers,
    rows: board.map((r) => radarRow(r, watchlist.has(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `the board has ${board.length} rows, under the 100-row floor`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd >= board[i - 1]!.implied_value_usd) return `row ${i + 1} does not fall below row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value over the $100T cap`;
  }
  return null;
}

/**
 * A compact data.js: the dashboard's whole dataset as one script, no fetch and no network.
 * Rows are positional arrays; the column order is fixed here and in dashboard/app.js:
 * [rank, slug, name, category, chains, tvl_usd, change_7d, age_days,
 *  peer_multiple, peer_peers, growth_multiplier, maturity_multiplier, implied_value_usd, on_watchlist]
 * Live rows: [slug, name, category, chains, tvl_usd, mcap_usd, change_7d].
 */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

// ---------------------------------------------------------------- farm plans
// The plan templates live in dashboard/plans.js, the one source of truth the page also loads.
// main.ts imports them here so board.json's farm steps and the page's plans can never drift apart.

import Plans from '../dashboard/plans.js';

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  return Plans.farmSteps(p, age);
}

export function stepText(step: FarmStep): string {
  return Plans.stepText(step);
}
