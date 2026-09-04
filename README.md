# BetLab

**Know the math before you bet.**

BetLab is a free, private, browser-based instrument for betting mathematics. You bring the odds and
your own probability estimate; BetLab shows the implied and fair probabilities, your edge, expected
value, risk, and a mathematically-sized stake — then lets you simulate outcomes and track your bets
locally. No accounts, no server, no fake picks.

> Educational and mathematical only. Not betting or financial advice. BetLab never predicts winners.

## Stack

- **Next.js 14** (App Router, static export) + **React 18** + **TypeScript** (strict)
- **Tailwind CSS** for styling with theme-aware CSS-variable tokens
- **Vitest** for the math-engine unit tests
- Zero backend — every calculation runs client-side. Deployable free on any static host.

## Architecture

The heart of the app is a **pure, framework-free math engine** in `src/engine/`. It imports nothing
from React/Next/DOM, returns a `Result<T>` discriminated union instead of throwing, and never leaks
`NaN`/`Infinity` to the UI. Everything the UI shows flows through it.

```
app/                     Next.js routes (home, /analyze, /tools/*, /simulator, /tracker, /learn, legal)
src/
  engine/                ★ pure math: odds, probability/de-vig, ev, edge, kelly, vig,
                           arbitrage, parlay, roi/drawdown, simulate, analyze (+ tests)
  models/                shared app/storage types
  persistence/           localStorage tracker + analytics + CSV/JSON import-export
  components/            UI: shell, calculators, analyzer, simulator, tracker
  hooks/                 useQueryState (URL <-> state for shareable results)
  lib/                   formatting, site constants
```

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # run the engine unit tests
npm run typecheck  # tsc --noEmit
npm run build      # static export to ./out
npm run test:e2e   # Playwright: builds, serves ./out, and drives it (desktop + 390px mobile)
```

## Simulation architecture

The Monte Carlo simulator (`src/engine/simulate.ts`) runs inside a Web Worker
(`src/workers/simulate.worker.ts`, driven by `src/hooks/useSimWorker.ts`) so
large runs never block the UI thread. It's seeded (mulberry32) so a shared
simulation link reproduces exactly.

## Math notes

- **Implied probability** = 1 / decimal odds (includes the bookmaker margin).
- **De-vig** supports two methods: proportional (default; simple but over-taxes favorites) and
  **Shin's method** (models the overround as informed/"insider" money, solved numerically via
  bisection for the insider proportion z; corrects the favorite-longshot bias). Selectable on the
  vig calculator (`/tools/vig-calculator`).
- **Arbitrage & hedging**: `/tools/arbitrage` detects and allocates stakes when the best prices across
  outcomes sum to less than 100%; `/tools/hedge` sizes a second bet on the opposing side to equalize
  profit against an existing bet.
- **Edge** is always reported as three labeled quantities (probability-point, relative, EV) — never
  one ambiguous number.
- **Kelly** = (p·d − 1)/(d − 1); negative Kelly is surfaced as "no bet", and fractional Kelly is
  recommended.
- **Simulation** is a seedable Monte Carlo so shared runs reproduce exactly.

## SEO / social

Every route gets a statically-generated Open Graph image (`opengraph-image.tsx`, rendered at build
time via `next/og` — see `src/lib/og.tsx`), plus per-tool canonical URLs, FAQ structured data, and a
sitemap/robots.txt derived from the shared `TOOLS` list in `src/lib/site.ts`.

Calibration/CLV analytics landed in the Tracker (`src/engine/calibration.ts`, surfaced via the
"Calibration & CLV" card on `/tracker`). A manual multi-book value scanner remains a planned V2
feature.

## Calibration & CLV

`summarize()` (`src/persistence/analytics.ts`) buckets settled bets that carry a probability
estimate (`Bet.estimatedProb`) and compares each bucket's average estimate to its actual win rate —
plus a Brier score — via `calibration()` in `src/engine/calibration.ts`. The Tracker's "Calibration &
CLV" card renders that as a reliability table once at least `MIN_CALIBRATION_BETS` (10) qualifying
bets exist; below that it shows a prompt to log more. Each bet row also has an inline **closing
odds** field (`store.updateBet(id, { closingDecimal })`) that feeds the average CLV
(`clv(takenDecimal, closingDecimal)`) shown alongside it.

## Deploy

`npm run build` produces a fully static site in `out/`. Host it free on GitHub Pages, Cloudflare
Pages, or Vercel. Set the real domain in `src/lib/site.ts` (`SITE.url`) for canonical URLs and the
sitemap.

### GitHub Pages (configured)

`.github/workflows/deploy-pages.yml` builds and publishes `out/` via GitHub Pages on every push to
`main` or `claude/calibration-closing-odds-etub7t`. Two one-time repo settings had to be set by hand
(not scriptable via the GitHub API/MCP tools available in this session) and are easy to lose track
of if the workflow file is ever copied to a new repo:

- **Settings → Pages → Build and deployment → Source: "GitHub Actions"** (not "Deploy from a
  branch"). Without this the workflow's `deploy` job fails outright.
- **Settings → Environments → github-pages → Deployment branches and tags**: must explicitly allow
  every branch the workflow deploys from (`main` is allowed by default when the environment is
  auto-created; other branches, like the one above, need to be added or the `deploy` job fails fast
  with no useful log).

This is a **project** Pages site, served under `/<repo>/` (currently `https://kuhguy3.github.io/demo/`),
not the domain root. `next.config.mjs` reads a `BASE_PATH` env var into `basePath`/`assetPrefix` so
the export's asset URLs and route links resolve correctly; the workflow sets `BASE_PATH=/demo` at
build time. Any internal link must use `next/link` (which applies `basePath` automatically) rather
than a raw `<a href="/...">`, or it will 404 once deployed. Local dev/`test:e2e` leave `BASE_PATH`
unset, so they still run un-prefixed at the domain root.
