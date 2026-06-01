// ============================================================================
// Release: Customer Base + Loyalty.
// Customers are a persistent STOCK per segment, not an instantaneous share.
// Each tick per active cell: acquire from the non-customer pool (rate = appeal share),
// retain/churn existing customers by satisfaction (fit×quality×value vs best rival, + brand trust),
// and generate revenue from repeat purchases. Word-of-mouth feeds back both directions.
// ============================================================================
import type { World, Cell } from "./types";
import { TICKS_PER_QUARTER, TICKS_PER_YEAR } from "./types";
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
  // weight absolute experience heavily — a bad product dissatisfies even with no competition
  return clamp(0.15 + qualityValue * 0.5 + rel * 0.25 + trust * 0.15, 0, 1);
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
  const satisfaction = cur.satisfaction + (satTarget - cur.satisfaction) * 0.05;

  // word-of-mouth: satisfied base (>0.6) accelerates acquisition; unhappy (<0.45) suppresses & repels
  const penetration = cell.head > 0 ? cur.count / cell.head : 0;
  const wom = 1 + (satisfaction - 0.55) * 1.2 * penetration; // >1 if happy & sizable, <1 if unhappy

  // ACQUIRE: win a fraction of non-customers proportional to appeal share & word-of-mouth.
  // acquireShare already collapses when awareness/marketing fade, so a neglected segment stops growing.
  const nonCustomers = Math.max(0, cell.head - cur.count);
  const acquireRate = clamp(acquireShare * 0.05 * Math.max(0.2, wom), 0, 0.4); // per tick
  const acquired = nonCustomers * acquireRate;

  // CHURN: dissatisfied customers leave. Low when satisfied, steep when not.
  const churnRate = clamp(0.015 + (0.72 - satisfaction) * 0.14, 0.004, 0.2);
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
  const churnRate = clamp(0.02 + (0.7 - c.satisfaction) * 0.08, 0.004, 0.12);
  const annualChurn = clamp(churnRate * (TICKS_PER_QUARTER * 4), 0.05, 0.95);
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
