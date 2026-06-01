import type { Cell, IndustryConfig, AxisKey, World, ProductType, Coord } from "./types";
import { AXES, AXIS_KEYS, axisPos, clamp, ease, PACKAGING, packagingNeedBias, LICENSES } from "./industries";

// deterministic small jitter per cell+need so "surprises within the trend" are stable across ticks
function jitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  // map to -0.18..0.18
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.36;
}

function seedNeedPref(cfg: IndustryConfig, coord: Coord): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const need of cfg.needs) {
    let v = 0.5;
    for (const axis of AXIS_KEYS) {
      const lean = need.lean[axis];
      if (lean == null) continue;
      const pos = axisPos(axis, AXES[axis].indexOf(coord[axis]));
      v += lean * (pos - 0.5);
    }
    v += jitter(`${coord.gender}${coord.age}${coord.class}${coord.leaning}${coord.geography}${coord.family}${need.key}`);
    raw[need.key] = clamp(v, 0.02, 1);
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  for (const k in raw) out[k] = raw[k] / total;
  return out;
}

// category affinity per segment, from each product type's categoryLean (+ noise)
function seedCategoryPref(cfg: IndustryConfig, coord: Coord): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pt of cfg.products) {
    let v = 0.55;
    if (pt.categoryLean) {
      for (const axis of AXIS_KEYS) {
        const lean = pt.categoryLean[axis];
        if (lean == null) continue;
        const pos = axisPos(axis, AXES[axis].indexOf(coord[axis]));
        v += lean * (pos - 0.5);
      }
    }
    v += jitter(`${coord.gender}${coord.age}${coord.class}${coord.geography}${coord.family}${pt.key}cat`);
    out[pt.key] = clamp(v, 0, 1);
  }
  return out;
}

const TOTAL_POP = 1_600_000;

export function buildCube(cfg: IndustryConfig): Cell[] {
  const ageShare: Record<string, number> = { "13-24": 0.20, "25-39": 0.28, "40-59": 0.30, "60+": 0.22 };
  const classShare: Record<string, number> = { Budget: 0.45, Middle: 0.40, Affluent: 0.15 };
  const leanShare: Record<string, number> = { Progressive: 0.34, Neutral: 0.34, Conservative: 0.32 };
  const geoShare: Record<string, number> = { Urban: 0.34, Suburban: 0.42, Rural: 0.24 };
  const famShare: Record<string, number> = { Single: 0.33, Couple: 0.30, Family: 0.37 };
  const cells: Cell[] = [];
  for (const g of AXES.gender) for (const a of AXES.age) for (const c of AXES.class) for (const l of AXES.leaning) for (const geo of AXES.geography) for (const fam of AXES.family) {
    const head = TOTAL_POP * 0.5 * ageShare[a] * classShare[c] * leanShare[l] * geoShare[geo] * famShare[fam];
    // spend modifiers: affluent suburban families spend more on toys; urban affluent on skincare, etc.
    const geoSpend = geo === "Urban" ? 1.1 : geo === "Suburban" ? 1.0 : 0.85;
    const spend = cfg.spend.class[c] * cfg.spend.gender[g] * cfg.spend.age[a] * geoSpend;
    const coord: Coord = { gender: g, age: a, class: c, leaning: l, geography: geo, family: fam };
    // frozen sensitivities, correlated with class (+ noise)
    const classPos = axisPos("class", AXES.class.indexOf(c)); // 0 budget .. 1 affluent
    const qualitySens = clamp(0.35 + classPos * 0.5 + jitter(`${g}${a}${c}${l}${geo}${fam}qs`), 0, 1);
    const priceSens = clamp(1.4 - classPos * 1.0 + jitter(`${g}${a}${c}${l}${geo}${fam}ps`) * 1.5, 0.2, 2.0);
    // channel preference: where this segment likes to shop (0..1 per channel type).
    // young + urban skew online/marketplace; older + rural skew retail; affluent enjoy flagship.
    const agePos = axisPos("age", AXES.age.indexOf(a));       // 0 young .. 1 old
    const urban = geo === "Urban" ? 1 : geo === "Suburban" ? 0.5 : 0;
    const channelPref: Record<string, number> = {
      marketplace: clamp(0.8 - agePos * 0.6 + urban * 0.15 + jitter(`${g}${a}${c}${geo}mk`), 0.05, 1),
      ownweb:      clamp(0.6 - agePos * 0.4 + urban * 0.1 + jitter(`${g}${a}${c}${geo}ow`), 0.05, 1),
      retail:      clamp(0.45 + agePos * 0.45 - urban * 0.15 + jitter(`${g}${a}${c}${geo}rt`), 0.05, 1),
      flagship:    clamp(0.25 + classPos * 0.5 + urban * 0.2 + jitter(`${g}${a}${c}${geo}fl`), 0.05, 1),
    };
    cells.push({
      coord, head, baseHead: head, spend, awareness: {},
      needPref: seedNeedPref(cfg, coord),
      qualitySens, priceSens,
      categoryPref: seedCategoryPref(cfg, coord),
      channelPref,
      // who cares about what: affluent → prestige/trust; budget → value; young → innovation
      equityPref: {
        trust:      clamp(0.5 + classPos * 0.25 + jitter(`${g}${a}${c}${geo}et`), 0.1, 1),
        prestige:   clamp(0.2 + classPos * 0.7 + jitter(`${g}${a}${c}${geo}ep`), 0.05, 1),
        value:      clamp(0.85 - classPos * 0.6 + jitter(`${g}${a}${c}${geo}ev`), 0.05, 1),
        innovation: clamp(0.6 - agePos * 0.4 + jitter(`${g}${a}${c}${geo}ei`), 0.05, 1),
      },
    });
  }
  return cells;
}

// How well a product's attribute vector matches a cell's need preferences.
// Weighted dot product: sum over needs of (cell preference for need * product's attribute on need),
// normalized by the product's total attribute mass so a product can't win just by maxing every slider.
export function needMatch(attributes: Record<string, number>, cell: Cell, cfg: IndustryConfig): number {
  let dot = 0, attrMass = 0;
  for (const need of cfg.needs) {
    const a = attributes[need.key] ?? 0;
    const p = cell.needPref[need.key] ?? 0;
    dot += a * p;
    attrMass += a;
  }
  if (attrMass <= 0) return 0.15; // a product with no clear attributes weakly matches everyone
  // dot is roughly in 0..max(pref); scale so a well-aligned product approaches ~1
  const normalized = dot / (attrMass / cfg.needs.length + 1e-6);
  return clamp(normalized * 0.6 + 0.2, 0, 1.2);
}

// Packaging resonance: how well a packaging preset's demographic lean matches the cell.
// ageLean/classLean in -1..1; we compare against the cell's age/class position.
export function packagingResonance(pkgKey: string, cell: Cell): number {
  const pkg = PACKAGING.find((p) => p.key === pkgKey);
  if (!pkg) return 1;
  const agePos = axisPos("age", AXES.age.indexOf(cell.coord.age));     // 0 young..1 old
  const classPos = axisPos("class", AXES.class.indexOf(cell.coord.class)); // 0 budget..1 affluent
  // lean of +1 means "skews old/premium": resonance high when cell is old/affluent.
  const ageMatch = 1 - Math.abs((pkg.ageLean + 1) / 2 - agePos);   // 0..1
  const classMatch = 1 - Math.abs((pkg.classLean + 1) / 2 - classPos);
  // blend; packaging matters but isn't everything → keep in a gentle band 0.7..1.15
  return clamp(0.7 + (ageMatch * 0.5 + classMatch * 0.5 - 0.5) * 0.9, 0.55, 1.15);
}

// Packaging-amplified attributes: needBias multiplies the perceived need attributes.
export function effectiveAttributes(industryId: string, pkgKey: string, attributes: Record<string, number>, licenseKey?: string | null): Record<string, number> {
  const bias = packagingNeedBias(industryId, pkgKey);
  const out: Record<string, number> = { ...attributes };
  for (const k in bias) out[k] = clamp((out[k] ?? 0) * bias[k], 0, 1);
  // license boosts "licensed" and "collectible" attributes proportional to pull × category relevance
  if (licenseKey) {
    const lic = LICENSES.find((l) => l.key === licenseKey);
    if (lic) {
      const cm = lic.categoryMult[industryId] ?? 1;
      const boost = lic.pull * cm;
      out["licensed"] = clamp((out["licensed"] ?? 0) + boost, 0, 1);
      out["collectible"] = clamp((out["collectible"] ?? 0) + boost * 0.5, 0, 1);
    }
  }
  return out;
}

// Channel fit: does the product reach this segment where it likes to shop?
// channels = the channel types carrying this product. If none, the product is unsold (0).
export function channelFit(channels: string[], cell: Cell): number {
  if (!channels || channels.length === 0) return 0; // not distributed anywhere → no sales
  // best preference among the channels we actually use (you reach them where they shop best)
  let best = 0;
  for (const ch of channels) best = Math.max(best, cell.channelPref[ch] ?? 0);
  // small bonus for multi-channel presence, capped
  const breadth = clamp(1 + (channels.length - 1) * 0.06, 1, 1.2);
  return clamp(best * breadth, 0, 1);
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
