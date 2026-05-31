# Market / Sim

A business-strategy simulation. Build a brand in a population modeled as a cube of
customer cells (age × gender × class × leaning), launch products that earn awareness
from zero, negotiate distribution contracts, and manage cash through working capital —
while competitors react and the population shifts under you.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL.

## Build

```bash
npm run build      # tsc + vite build -> dist/
npm run preview    # preview the production build
```

## Deploy to GitHub Pages

1. Create a repo named **market-sim** (the name must match `base` in `vite.config.ts`).
   If you use a different name, update `base: "/<repo-name>/"` there.
2. Push to `main`.
3. In the repo: **Settings → Pages → Source → GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` builds and deploys on every push.
   Live URL: `https://<your-username>.github.io/market-sim/`

## Architecture

```
src/
  engine/        pure simulation (no React) — testable in isolation
    types.ts       domain types
    industries.ts  configs, axes, channels, helpers
    cube.ts        population, fit (+ product natural lean), drift & shocks
    economics.ts   cost derivation, contract reach
    tick.ts        the step() loop: awareness, per-cell contribution, working capital, competitor reactions
    world.ts       init, SKU builder, studies
  state/useGame.ts game loop hook + actions
  ui/              views & components (render off engine state)
```

The engine is deliberately free of React so it can be unit-tested and reused.

## Current state (v0.5)

Implemented: population cube, awareness-gated share, distribution contracts with
payment terms, full income statement, working-capital cash flow, contribution
margin by customer cell, product-type natural demographic lean, full competitor
AI (invade / defend / escalate / exit with personalities), and **strategy reports**
— a Strategy tab with a generated quarterly board memo (frames issues as
questions), SWOT derived from live state, Porter's Five Forces scored as live
pressure, and a BCG portfolio matrix (Star / Cash Cow / Question Mark / Dog).

Stubs / next milestones: brand equity (trust/prestige separate from awareness) —
**Milestone 4**, scenario mode with win conditions — **Milestone 5**,
own-production factories.

The strategy reports are deliberately framing tools: they surface tensions and
pose questions, never prescribe the answer.
