# Token Radar — build log

Entry for make.fun bounty **token-radar-01** (Build the best token launch radar, $1,325,
deadline Mon 2026-12-14 10:00 UTC = 17:00 WIB). Built 2026-11-15 by the agent session, in
`~/workspace/makefun/token-radar/`. Kit at `~/workspace/makefun/token-radar-01-kit/`.
Account already connected as `@mochamad-rachman-al-farizh`; no login, submit, repo or spend
was done in this session — build + local verification only.

## What was built

| File | What it is |
| --- | --- |
| `main.ts` | The program: snapshot in, `board.json` + `data.js` + `dashboard/` + `screenshots/` + `dossier.json` out. Node 22, stdlib only. Same CLI contract as the kit (`--input`, `--output` / `MAKEFUN_OUTPUT_DIR`, `/input` default). |
| `lib/model.ts` | The peer-multiple model, the board builder, the gate self-check. Written in-session, not copied from the starter. |
| `dashboard/plans.js` | The farm-plan templates — the one source of truth: `main.ts` imports it for `board.json` and the page loads it for the detail view, so the two can never drift. |
| `dashboard/index.html`, `app.css`, `app.js` | The static page: dark radar-console theme, board + watchlist + live-token tabs, search/category/chain/min-TVL/sort, detail drawer with the full working, hash routing (`#p=`, `#cat=`, `#tab=`). No network requests. |
| `vendor/makefun-board.ts` | make.fun's dossier library, byte-for-byte the kit's copy (sha256 `9ca51b6e…dc326e`, verified identical). |
| `screenshots/01-board.jpg`, `02-detail.jpg`, `03-filtered.jpg` | 1440×900 JPEGs (125,628 / 139,647 / 109,080 bytes). |
| `LICENSE` (MIT), `README.md` | Repo docs. |

## The model (`radar-peer-1`)

`implied = TVL × peer multiple × growth multiplier × maturity multiplier`

- **Peer multiple**: median market-cap/TVL of the token-bearing protocols in the same category
  (≥3 peers; otherwise the global median, this snapshot **0.2138**), clamped to 0.05–2.50.
  A protocol is worth what its category's traded peers are worth per dollar of TVL.
- **Growth**: `1 + clamp(change_7d, −50, +100)/100 × 0.5`.
- **Maturity**: `0.70 + min(age_days, 1095)/1095 × 0.45`; unknown age = 365 days.
- **Coverage**: all 40 watchlist slugs, plus every other protocol passing the same exclusion rule
  the watchlist uses (no Bridge/Canonical Bridge/Liquid Staking/Liquid Restaking/Restaked BTC/CEX
  category, no versioned name, no exchange name, no wrapped/staked/staking/restaking/restaked
  word) — whatever its TVL. **197 rows** (40 watchlist + 157 early), total implied **$4,194,289,231**.
- Top 5: Steakhouse Financial $537.6M · Sentora Curator $517.4M · Gauntlet $320.2M ·
  Veda $307.5M · USDD $167.0M. Farm steps: 6 per row, 131–226 chars each.

Differences from the kit starter (deliberate, not copied): category peer multiples instead of a
flat 0.25× base; the watchlist's own exclusion rule applied to the early rows too (the starter's
early rows admit bridges/liquid-staking/wrapped products); chain-aware gas costs and
category-specific farm actions; a dark console design; the page recomputes each row's implied
value from its stored factors and shows the working.

## Verification (2026-11-15, all passed)

Run: `MAKEFUN_OUTPUT_DIR=out node main.ts --input …/token-radar-01-kit/input/snapshot.json`
(also run twice into `out`/`out2` — `diff -r` byte-identical, then `out2` removed).

Independent gate check (`/tmp/verify.mjs` + `/tmp/verify2.mjs`, 19 checks):

- Dashboard: 4 files, 41,116 bytes (text 41,455 ≤ 65,536 cap); no `http(s)://`, `fetch(`,
  `XMLHttpRequest`, `@import` or `url(http` anywhere in the dashboard files.
- Board: 197 rows (100–4,000); every slug exists in the snapshot; ranks exactly 1..197;
  implied values strictly non-increasing, range $657,088–$537,590,862, all ≤ $100T.
- Coverage: 40/40 watchlist slugs present.
- Farm steps: 197 × 6, every step 20–600 chars.
- Screenshots: 3 JPEGs, 1440×900 each, each ≤ 512 KiB; cover is `01-board.jpg`.
- Dossier: 542,326 bytes (≤ 1.5 MiB), schema `makefun/dossier/v1`, and
  `dossier.json` equals `buildDossier(/output)` byte-for-byte when rebuilt independently.
- `data.js` parses as JSON; its 197 rows match `board.json` slugs + values exactly; the page's
  recomputation from the stored factors equals the board value for **all 197 rows** (0 differences).
- Page render check in headless Chromium (CDP): 197 board rows, 34 peer-table rows, 24 live rows
  on the live tab, formula + facts rendered, all scripts local `file://` only.

Bugs found and fixed during verification:
1. Hash routing: `#cat=` set the filter but the board was rendered before it was applied
   (filtered screenshot showed all 197 rows). Fixed — `readHash()` now renders after applying.
2. Detail equation: the page recomputed from factors rounded to 4 decimals, so the model value
   differed from the board value by up to ~$11K and was mislabelled a "strict-order adjustment".
   Fixed — factors are stored full-precision; the equation is now exact (verified: 0 differences
   across all rows) and the adjustment line appears only for a genuine tie-break decrement
   (none occurred on this snapshot).

## Screenshots — how they were taken

`--screenshot`/`--dump-dom` one-shot modes do not work in this Chromium build
(`/opt/meta-chromium/chrome`, "Muse Browser 157.0.8103.77"): the process exits 0 with no output.
What works: launch with `--remote-debugging-port=9222` plus the real WebGL policy file
`--hatch-webgl-allowed-domains-file=/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt`
and its sha256, then drive it over CDP with Node 22's built-in WebSocket (driver at
`/tmp/chrometest/shot.mjs`). Two gotchas recorded: a fresh target created via `PUT /json/new`
ignores the `url` parameter (lands on `about:blank`), and a fragment-only navigation does not
reload the page — the driver navigates via `about:blank` first, then to the real URL, so
`#p=` / `#cat=` / `#tab=` hash routing runs. The dashboard also gained a `hashchange` listener
so fragment navigation works live.

## What remains before submission (parent's job, not this build)

1. Create the public GitHub repo under the user's account **setyamickala** (created after
   2026-11-14 10:00 UTC, OSI license = MIT file already in the repo). Include `main.ts`,
   `lib/`, `dashboard/`, `vendor/`, `screenshots/`, `LICENSE`, `README.md`, `BUILD_LOG.md`.
   (`out/` is generated output — it can be left out of the repo or gitignored.)
2. README: check it against the requirements template from the competition's `/requirements`
   endpoint before submitting (this README was written from the brief; the template may ask for
   specific sections).
3. Transcript bundle via the kit CLI (`cli/makefun.mjs`), then `check`, then `submit` — before
   **2026-12-14 17:00 WIB**. Max 5 submissions/day, 10 total; the last submission before the
   deadline is the final entry.
4. If the snapshot ever changes (it is sealed, so it should not), re-run `main.ts` and re-verify;
   the build is deterministic, so a re-run reproduces `out/` byte-for-byte.
