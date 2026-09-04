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
```

## Math notes

- **Implied probability** = 1 / decimal odds (includes the bookmaker margin).
- **De-vig** uses the proportional method by default — simple but slightly biased toward favorites;
  the method is a parameter so better methods (Shin / power) can be added later.
- **Edge** is always reported as three labeled quantities (probability-point, relative, EV) — never
  one ambiguous number.
- **Kelly** = (p·d − 1)/(d − 1); negative Kelly is surfaced as "no bet", and fractional Kelly is
  recommended.
- **Simulation** is a seedable Monte Carlo so shared runs reproduce exactly.

See the planning document for the full specification and roadmap (calibration/CLV analytics and a
manual multi-book value scanner are the planned V2 headline features).

## Deploy

`npm run build` produces a fully static site in `out/`. Host it free on GitHub Pages, Cloudflare
Pages, or Vercel. Set the real domain in `src/lib/site.ts` (`SITE.url`) for canonical URLs and the
sitemap.
