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

## Current state (v0.10)

**Customer base + loyalty.** Revenue is no longer an instantaneous share — it's
driven by a persistent customer *stock* per segment. Each period you acquire new
customers from the segment's non-customer pool (rate = your appeal share), retain
most of your existing base, and lose a fraction to churn. Churn is governed by
**satisfaction** — the absolute quality/value your product delivers to that
segment plus how you compare to the best rival, lifted by brand trust. Revenue
comes from repeat purchases by the retained base; satisfied customers buy more and
spread positive **word-of-mouth** (free acquisition), while a dissatisfied base
churns out and dampens growth. A Customers tab shows total base, satisfaction, and
per-segment penetration / churn / lifetime value.

This makes a won segment an asset you must keep satisfied: neglect it, overprice
it, or let a rival out-serve it and satisfaction falls, churn rises, and the base
erodes with momentum. Brand trust now has teeth (it buffers churn), and a happy,
well-distributed base compounds cheaply.

Built on the 648-segment cube, Segment Manager, per-product distribution/packaging
with Product Diagnosis, brand equity, full competitor AI, and strategy reports.

Next (roadmap order): Capital Allocation + Investments (factories, automation, R&D,
flagship builds). Also queued: deliberate market growth (category-building
marketing gated by your share).
