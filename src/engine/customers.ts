// ============================================================================
// Release: Customer Base + Loyalty.
// Customers are a persistent STOCK per segment, not an instantaneous share.
// Each tick per active cell: acquire from the non-customer pool (rate = appeal share),
// retain/churn existing customers by satisfaction (fit×quality×value vs best rival, + brand trust),
// and generate revenue from repeat purchases. Word-of-mouth feeds back both directions.
// ============================================================================
import type { World, Cell } from "./types";
import { TICKS_PER_QUARTER, TICKS_PER_YEAR, TICK_RATE_SCALE } from "./types";
import { clamp } from "./industries";

export type CustomerCell = { count: number; satisfaction: number };

export function getCustomers(w: World, ci: number): CustomerCell {
  return w.customers[ci] ?? { count: 0, satisfaction: 0.6 };
}

// Satisfaction target: how well our offer serves this segment relative to the best rival,
// lifted by brand trust. 0..1. playerShareEff is our appeal, bestRivalEff the strongest competitor's.
// Satisfaction target combines how we compare to the best rival (relative) with the absolute
// quality/value the customer actually experiences, lifted by brand trust.
// qualityValue: 0..1 absolute experience (segment-perceived quality × price fairness).
export function satisfactionTarget(playerEff: number, bestRivalEff: number, trust: number, qualityValue: number): number {
  const rel = playerEff / (playerEff + bestRivalEff + 1e-6); // 0..1 head-to-head
  // absolute experience dominates: a bad/overpriced product dissatisfies even with no competition.
  // a quality-0.2 product yields qualityValue ~0.2 → satisfaction ~0.3 (steep churn); a great one ~0.9.
  return clamp(0.05 + qualityValue * 0.7 + rel * 0.12 + trust * 0.13, 0, 1);
}

// Per-tick customer update for one cell. Returns ANNUAL run-rate revenue from this cell.
// - acquireShare: our appeal / total appeal (0..1) — the rate we win NON-customers
// - satTarget: satisfaction target from satisfactionTarget()
// - spendPerHead: annual $ per person in this segment
export function updateCustomers(
  w: World, ci: number, cell: Cell, acquireShare: number, satTarget: number, spendPerHead: number
): number {
  const cur = w.customers[ci] ?? { count: 0, satisfaction: satTarget };
  // satisfaction eases toward target (experience accumulates, doesn't snap)
  const satisfaction = cur.satisfaction + (satTarget - cur.satisfaction) * 0.05 * TICK_RATE_SCALE;

  // word-of-mouth: a happy, well-penetrated base AMPLIFIES acquisition; an unhappy one suppresses it.
  // Crucially this multiplies acquireShare (which itself collapses when marketing/awareness fade) —
  // so word-of-mouth can't manufacture growth on its own without ongoing reach.
  const penetration = cell.head > 0 ? cur.count / cell.head : 0;
  const wom = clamp(1 + (satisfaction - 0.6) * 0.7 * penetration, 0.3, 1.25);

  // ACQUIRE: win a fraction of non-customers, driven by appeal share (gated on awareness/marketing) × WoM.
  const nonCustomers = Math.max(0, cell.head - cur.count);
  const acquireRate = clamp(acquireShare * 0.03 * TICK_RATE_SCALE * wom, 0, 0.3);
  const acquired = nonCustomers * acquireRate;

  // CHURN: dissatisfied customers leave; also natural attrition that acquisition must outrun.
  // Steeper when satisfaction is low so a genuinely bad product visibly bleeds the base.
  const churnRate = clamp((0.02 + (0.7 - satisfaction) * 0.28) * TICK_RATE_SCALE, 0.003, 0.2);
  const churned = cur.count * churnRate;

  const count = clamp(cur.count + acquired - churned, 0, cell.head);
  w.customers[ci] = { count, satisfaction };

  const repeatLift = 0.7 + satisfaction * 0.5; // 0.7..1.2
  const annualRev = count * spendPerHead * repeatLift;
  return annualRev;
}

// Lifetime value estimate for a cell's customers: annual spend × repeat / churn-implied lifetime.
export function cellLTV(w: World, ci: number, spendPerHead: number): number {
  const c = getCustomers(w, ci);
  const churnRate = clamp(0.02 + (0.7 - c.satisfaction) * 0.28, 0.01, 0.35);
  const annualChurn = clamp(churnRate * (TICKS_PER_QUARTER * 4), 0.05, 0.97);
  const lifetimeYears = 1 / annualChurn;
  const repeatLift = 0.7 + c.satisfaction * 0.5;
  return spendPerHead * repeatLift * lifetimeYears;
}

// Aggregate stats for the Customer Base view.
export function customerTotals(w: World) {
  let total = 0, satWeighted = 0, count = 0;
  for (const k in w.customers) {
    const c = w.customers[k];
    total += c.count; satWeighted += c.satisfaction * c.count; count++;
  }
  return { total, avgSatisfaction: total > 0 ? satWeighted / total : 0, activeCells: count };
}

// Word-of-mouth spillover: satisfied, well-penetrated segments lift awareness in DEMOGRAPHICALLY
// ADJACENT segments (same coords but one axis-step away) — a smaller, free echo of a local hit.
// Runs once per tick after the main loop; cheap because it only iterates cells we have customers in.
export function applyWordOfMouthSpillover(w: World, adjacency: Record<number, number[]>) {
  const skuIds = w.player.skus.map((s) => s.id);
  if (skuIds.length === 0) return;
  for (const k in w.customers) {
    const ci = Number(k);
    const c = w.customers[ci];
    const cell = w.cube[ci];
    const penetration = cell.head > 0 ? c.count / cell.head : 0;
    // only happy, meaningfully-penetrated segments generate buzz worth spilling
    const buzz = (c.satisfaction - 0.6) * penetration; // can be negative (bad buzz)
    if (Math.abs(buzz) < 0.01) continue;
    const neighbors = adjacency[ci];
    if (!neighbors) continue;
    const spill = clamp(buzz * 0.06, -0.02, 0.02); // small per-tick echo
    for (const nj of neighbors) {
      for (const id of skuIds) {
        const cur = w.cube[nj].awareness[id] ?? 0;
        if (cur > 0.005 || spill > 0) w.cube[nj].awareness[id] = clamp(cur + spill * (1 - cur), 0, 1);
      }
    }
  }
}

// Precompute adjacency once (cells differing by exactly one axis-step on age/class/geography/family).
export function buildAdjacency(w: World): Record<number, number[]> {
  const adj: Record<number, number[]> = {};
  const idxByKey: Record<string, number> = {};
  const key = (c: Cell["coord"]) => `${c.gender}|${c.age}|${c.class}|${c.leaning}|${c.geography}|${c.family}`;
  w.cube.forEach((cell, i) => { idxByKey[key(cell.coord)] = i; });
  const order: Record<string, string[]> = {
    age: ["13-24", "25-39", "40-59", "60+"],
    class: ["Budget", "Middle", "Affluent"],
    geography: ["Urban", "Suburban", "Rural"],
    family: ["Single", "Couple", "Family"],
  };
  w.cube.forEach((cell, i) => {
    const list: number[] = [];
    for (const axis of Object.keys(order) as (keyof typeof order)[]) {
      const vals = order[axis];
      const idx = vals.indexOf((cell.coord as any)[axis]);
      for (const step of [-1, 1]) {
        const nv = vals[idx + step];
        if (!nv) continue;
        const nc = { ...cell.coord, [axis]: nv };
        const ni = idxByKey[key(nc as Cell["coord"])];
        if (ni != null) list.push(ni);
      }
    }
    adj[i] = list;
  });
  return adj;
}
