// ============================================================================
// Brand Equity — now per CATEGORY (productKey) per cell.
// Hot Wheels is huge in toy cars, not in dolls. A new serum inherits serum equity;
// a new cleanser inherits cleanser equity + a fraction of overall brand equity.
// ============================================================================
import type { World, Cell, SKU } from "./types";
import { TICK_RATE_SCALE } from "./types";
import { clamp, ease, sum, CHANNEL_TYPES } from "./industries";

export type Equity = { trust: number; prestige: number; value: number; innovation: number };
const ZERO: Equity = { trust: 0, prestige: 0, value: 0, innovation: 0 };

function catMap(w: World, cat: string): Record<number, Equity> {
  if (!w.brandEquity[cat]) w.brandEquity[cat] = {};
  return w.brandEquity[cat];
}

export function getEquity(w: World, cellIndex: number, productKey?: string): Equity {
  if (productKey) return catMap(w, productKey)[cellIndex] ?? ZERO;
  // aggregate across all categories (for display / backward compat)
  const acc: Equity = { ...ZERO }; let n = 0;
  for (const cat in w.brandEquity) {
    const e = w.brandEquity[cat][cellIndex];
    if (e) { acc.trust += e.trust; acc.prestige += e.prestige; acc.value += e.value; acc.innovation += e.innovation; n++; }
  }
  if (n === 0) return ZERO;
  return { trust: acc.trust / n, prestige: acc.prestige / n, value: acc.value / n, innovation: acc.innovation / n };
}

export function brandAverageEquity(w: World, productKey?: string): Equity {
  const cats = productKey ? [productKey] : Object.keys(w.brandEquity);
  let tw = 0; const acc: Equity = { trust: 0, prestige: 0, value: 0, innovation: 0 };
  for (const cat of cats) {
    const m = w.brandEquity[cat];
    if (!m) continue;
    for (const k in m) {
      const ci = Number(k); const head = w.cube[ci]?.head ?? 0; const e = m[ci];
      tw += head; acc.trust += e.trust * head; acc.prestige += e.prestige * head;
      acc.value += e.value * head; acc.innovation += e.innovation * head;
    }
  }
  if (tw <= 0) return { ...ZERO };
  return { trust: acc.trust / tw, prestige: acc.prestige / tw, value: acc.value / tw, innovation: acc.innovation / tw };
}

export function equityDemandMult(w: World, cellIndex: number, cell: Cell, productKey?: string): number {
  const e = getEquity(w, cellIndex, productKey);
  const p = cell.equityPref;
  const prefMass = (p.trust + p.prestige + p.value + p.innovation) || 1;
  const weighted = (e.trust * p.trust + e.prestige * p.prestige + e.value * p.value + e.innovation * p.innovation) / prefMass;
  return 0.8 + weighted * 0.55;
}

export function pricingPower(w: World, cellIndex: number, productKey?: string): number {
  const e = getEquity(w, cellIndex, productKey);
  return clamp(e.prestige * 0.6, 0, 0.6);
}

export function trustAwarenessLift(w: World, cellIndex: number, productKey?: string): number {
  return 1 + getEquity(w, cellIndex, productKey).trust * 0.25;
}

export function updateEquity(
  w: World, cellIndex: number, productKey: string, brandPower: number, focusMatch: number,
  signals: { prestige: number; value: number; trust: number; innovation: number }
) {
  const m = catMap(w, productKey);
  const cur = m[cellIndex] ?? { ...ZERO };
  const drive = clamp(0.004 * TICK_RATE_SCALE * (0.4 + brandPower * focusMatch));
  const decay = 0.0012 * TICK_RATE_SCALE;
  const step = (val: number, target: number) => clamp(val + (target - val) * drive - (brandPower < 0.05 ? val * decay : 0), 0, 1);
  m[cellIndex] = {
    trust: step(cur.trust, signals.trust),
    prestige: step(cur.prestige, signals.prestige),
    value: step(cur.value, signals.value),
    innovation: step(cur.innovation, signals.innovation),
  };
}

export function earnedSignals(w: World): { prestige: number; value: number; trust: number; innovation: number } {
  const skus = w.player.skus;
  if (skus.length === 0) return { prestige: 0.2, value: 0.4, trust: 0.3, innovation: 0.3 };
  const avgPrice = sum(skus.map((s) => s.listPrice)) / skus.length;
  const avgQuality = sum(skus.map((s) => s.quality)) / skus.length;
  const avgOnline = sum(skus.map((s) => s.online)) / skus.length;
  const priceLevel = clamp((avgPrice / 45 - 0.6) / 1.2, 0, 1);
  const allCh = skus.flatMap((s) => s.channels);
  const flagshipShare = allCh.length ? allCh.filter((c) => c === "flagship").length / allCh.length : 0;
  const marketplaceShare = allCh.length ? allCh.filter((c) => c === "marketplace").length / allCh.length : 0;
  const sci = sum(skus.map((s) => (s.attributes["scientific"] ?? 0) + (s.attributes["creative"] ?? 0))) / skus.length;
  return {
    prestige: clamp(priceLevel * 0.7 + flagshipShare * 0.4 - marketplaceShare * 0.3, 0, 1),
    value: clamp((1 - priceLevel) * 0.8 + marketplaceShare * 0.2, 0, 1),
    trust: clamp(0.25 + avgQuality * 0.7, 0, 1),
    innovation: clamp(0.3 + sci * 0.4 + avgOnline * 0.3, 0, 1),
  };
}

// Launch inheritance: new SKU inherits its own CATEGORY's equity + a fraction of the overall brand.
export function launchInheritance(w: World, cellIndex: number, productKey: string): number {
  const catEq = getEquity(w, cellIndex, productKey);
  const overallEq = getEquity(w, cellIndex); // aggregate
  const catStr = (catEq.trust + catEq.prestige + catEq.innovation) / 3;
  const overallStr = (overallEq.trust + overallEq.prestige + overallEq.innovation) / 3;
  // same category gets full inheritance; cross-category gets 30% of overall brand
  const strength = catStr > 0.01 ? catStr : overallStr * 0.3;
  return clamp(strength * 0.4, 0, 0.4);
}
