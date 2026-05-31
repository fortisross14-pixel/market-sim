import type { Cell, IndustryConfig, AxisKey, World, ProductType } from "./types";
import { AXES, AXIS_KEYS, axisPos, clamp, ease } from "./industries";

const TOTAL_POP = 1_600_000; // playable scale: cell markets in low millions, demand in tens of thousands

export function buildCube(cfg: IndustryConfig): Cell[] {
  const ageShare: Record<string, number> = { "13-24": 0.20, "25-39": 0.28, "40-59": 0.30, "60+": 0.22 };
  const classShare: Record<string, number> = { Budget: 0.45, Middle: 0.40, Affluent: 0.15 };
  const leanShare: Record<string, number> = { Progressive: 0.34, Neutral: 0.34, Conservative: 0.32 };
  const cells: Cell[] = [];
  for (const g of AXES.gender) for (const a of AXES.age) for (const c of AXES.class) for (const l of AXES.leaning) {
    const head = TOTAL_POP * 0.5 * ageShare[a] * classShare[c] * leanShare[l];
    const spend = cfg.spend.class[c] * cfg.spend.gender[g] * cfg.spend.age[a];
    cells.push({ coord: { gender: g, age: a, class: c, leaning: l }, head, baseHead: head, spend, awareness: {} });
  }
  return cells;
}

// Effective target blends the player's chosen target with the product TYPE's natural lean.
// e.g. anti-aging cream pulls toward older cells even if you aim it slightly younger.
export function effectiveTarget(
  target: Record<AxisKey, number>,
  productType: ProductType | undefined
): Record<AxisKey, number> {
  if (!productType?.naturalLean) return target;
  const out = { ...target };
  for (const axis of AXIS_KEYS) {
    const lean = productType.naturalLean[axis];
    if (lean != null) out[axis] = 0.6 * target[axis] + 0.4 * lean;
  }
  return out;
}

export function fit(targetObj: Record<AxisKey, number>, cell: Cell, cfg: IndustryConfig): number {
  let d2 = 0;
  for (const axis of AXIS_KEYS) {
    const w = cfg.axisWeight[axis];
    if (!w) continue;
    const cellPos = axisPos(axis, AXES[axis].indexOf(cell.coord[axis]));
    const dist = (targetObj[axis] ?? 0.5) - cellPos;
    d2 += w * dist * dist;
  }
  return Math.exp(-d2 * 6);
}

export function applyDriftAndShocks(w: World) {
  // gentle pull toward base each year
  if (w.tick % 12 === 0) {
    for (const cell of w.cube) cell.head = ease(cell.head, cell.baseHead, 0.02);
  }
  // schedule a shock
  if (w.tick === w.pendingShockTick) {
    if (Math.random() < 0.5) {
      w.events.push({ tick: w.tick, kind: "natality", text: "📉 Natality crash — the 13-24 cohort begins shrinking for years." });
      w.shock = { type: "natality", ticksLeft: 120 };
    } else {
      const dir = Math.random() < 0.5 ? "Conservative" : "Progressive";
      w.events.push({ tick: w.tick, kind: "culture", text: `🌀 Cultural swing — population drifting toward ${dir}.` });
      w.shock = { type: "culture", dir, ticksLeft: 120 };
    }
    w.pendingShockTick = w.tick + 160 + Math.floor(Math.random() * 120);
  }
  // apply active shock
  if (w.shock) {
    if (w.shock.type === "natality") {
      for (const c of w.cube) if (c.coord.age === "13-24") c.head *= 0.9986;
    } else if (w.shock.type === "culture") {
      const from = w.shock.dir === "Conservative" ? "Progressive" : "Conservative";
      for (const c of w.cube) {
        if (c.coord.leaning === from) {
          const m = c.head * 0.0015;
          c.head -= m;
          const tgt = w.cube.find((x) =>
            x.coord.gender === c.coord.gender && x.coord.age === c.coord.age &&
            x.coord.class === c.coord.class && x.coord.leaning === "Neutral");
          if (tgt) tgt.head += m;
        }
      }
    }
    w.shock.ticksLeft -= 1;
    if (w.shock.ticksLeft <= 0) w.shock = null;
  }
}
