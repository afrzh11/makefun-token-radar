# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/afrzh11/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/afrzh11/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Which pre-token protocol is worth farming next — and what to do about it. An entry for the [make.fun](https://make.fun) bounty **token-radar-01** ("Build the best token launch radar"). It reads a sealed snapshot of every protocol DefiLlama tracks, works out which ones still record no token and are not a wrapped or staked product of one that trades, ranks them by what their launch would be worth, and hands in a web dashboard with the board, a detail view for every protocol, and the steps to farm it.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=00whd2w5&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

## About this entry

Node.js 22.18 or later, standard library only — nothing to install.

```sh
# the grader mounts the sealed snapshot at /input
node main.ts

# outside the grader's container:
MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

`main.ts` writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the
output directory (`/output` by default). Run it twice and the output is byte-for-byte identical.

## The model

`lib/model.ts` — a comparables model, computed only from the snapshot's own figures:

```
implied = TVL × peer multiple × growth multiplier × maturity multiplier
```

- **Peer multiple.** The median market-cap/TVL of the token-bearing protocols in the same
  category (at least 3 peers; otherwise the median over every token-bearing protocol), clamped to
  0.05–2.50. A protocol is worth what its category's traded peers are worth per dollar of TVL.
- **Growth multiplier.** `1 + clamp(change_7d, −50, +100) / 100 × 0.5`.
- **Maturity multiplier.** `0.70 + min(age_days, 1095) / 1095 × 0.45`; unknown age counts as 365 days.
- **Coverage.** The board covers all 40 watchlist slugs, then every other protocol that passes the
  same exclusion rule the watchlist uses — no bridge, liquid-staking or exchange product, no
  versioned pool, no exchange's name, no wrapped/staked word in its name — whatever its TVL.
  On the 2026-11-14 snapshot that is 197 rows, with a total implied value of about $4.2B.

No protocol name is ever special-cased. The dashboard shows the four factors for every row so a
reader can check the arithmetic. An implied value is this radar's own claim, not a price and not a
promise that a token will ever exist.

## The dashboard

`dashboard/` is a static page with no framework and no network requests: it renders only from
`data.js` written beside it.

- **Board** — the ranked list, with TVL, 7-day change, age, peer multiple and implied value.
  Filter by search, category, chain and minimum TVL; sort by implied value, TVL, growth or age.
- **Watchlist** — the 40 watchlist slugs on their own.
- **Live tokens** — the protocols that already trade, shown for comparison only, at the market's
  own value, never mixed into the ranked board.
- **Detail view** — click any row: the full working behind its number (each factor, the product,
  and the strict-order adjustment when two rows tie), the peer-multiple note, a six-step farm plan
  with cost and time, and the protocol's record.
- **Methodology** — the formula, the coverage rule, and the peer-multiple table for every category.

Farm plans live in `dashboard/plans.js`, the one source of truth: `main.ts` imports the same file
to write `board.json`'s farm steps, so the plans in the board and the plans on the page can never
drift apart. Each plan is derived from the protocol's own record (category, chains, TVL, age);
costs are approximate ranges, never quotes.

## Layout

```
main.ts                  the program: snapshot in, board + dashboard + dossier out
lib/model.ts             the peer-multiple model, the board builder, the gate self-check
dashboard/index.html     the page
dashboard/app.css        the dark console theme
dashboard/app.js         rendering, filtering, detail view, hash routing
dashboard/plans.js       the farm-plan templates (shared by the program and the page)
vendor/makefun-board.ts  make.fun's dossier library, byte for byte the kit's copy
screenshots/             the board, a detail view and a filtered view (1440×900)
LICENSE                  MIT
```

## Honesty notes

- "Records no token" is what the snapshot says — DefiLlama records no market cap, no CoinGecko
  id and no symbol for these protocols. It is not proof that no token exists.
- A high implied value means "big and credible enough that a launch at its category's usual
  multiple would be large" — not that a token is coming, and not what it would list at.
- Farm plans never tell anyone to pay to claim anything. Any claim link that does not come from
  the protocol's own page is not to be trusted.

## License

MIT — see `LICENSE`.
