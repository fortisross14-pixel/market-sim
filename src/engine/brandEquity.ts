// ============================================================================
// Release: Brand Equity.
// Awareness = "do they know us?"; equity = "what do they believe?"
// Four per-segment metrics: trust, prestige, value, innovation (each 0..1).
// Built by BRAND marketing (slow) + EARNED from the consistency of your choices
// (premium pricing → prestige; discounting → value but −prestige; quality → trust;
//  flagship → prestige; marketplace dependence → −prestige; high online/innovation attrs → innovation).
// Effects: (1) shifts demand in segments that value the metric, (2) grants pricing
// power + a higher awareness ceiling, (3) new SKUs inherit the brand's equity at launch.
// ============================================================================
import type { World, Cell, SKU } from "./types";
import { clamp, ease, sum, CHANNEL_TYPES } from "./industries";

export type Equity = { trust: number; prestige: number; value: number; innovation: number };
const ZERO: Equity = { trust: 0, prestige: 0, value: 0, innovation: 0 };

export function getEquity(w: World, cellIndex: number): Equity {
  return w.brandEquity[cellIndex] ?? ZERO;
}

// brand-wide average equity (population-weighted over touched cells) — used for new launches & the tracker
export function brandAverageEquity(w: World): Equity {
  const idxs = Object.keys(w.brandEquity).map(Number);
  if (idxs.length === 0) return { ...ZERO };
  let tw = 0; const acc: Equity = { ...ZERO };
  for (const i of idxs) {
    const head = w.cube[i].head;
    tw += head;
    const e = w.brandEquity[i];
    acc.trust += e.trust * head; acc.prestige += e.prestige * head;
    acc.value += e.value * head; acc.innovation += e.innovation * head;
  }
  if (tw <= 0) return { ...ZERO };
  return { trust: acc.trust / tw, prestige: acc.prestige / tw, value: acc.value / tw, innovation: acc.innovation / tw };
}

// How strongly this segment is swayed by the brand's equity here — weighted by what the segment cares about.
// Returns a multiplier around 1.0 (≈0.8 weak brand .. ≈1.35 strong brand in a segment that values it).
export function equityDemandMult(w: World, cellIndex: number, cell: Cell): number {
  const e = getEquity(w, cellIndex);
  const p = cell.equityPref;
  const prefMass = (p.trust + p.prestige + p.value + p.innovation) || 1;
  const weighted = (e.trust * p.trust + e.prestige * p.prestige + e.value * p.value + e.innovation * p.innovation) / prefMass;
  return 0.8 + weighted * 0.55; // 0.8 .. 1.35
}

// Prestige grants pricing power: how much the price penalty is softened (0..~0.6).
export function pricingPower(w: World, cellIndex: number): number {
  const e = getEquity(w, cellIndex);
  return clamp(e.prestige * 0.6, 0, 0.6);
}

// Trust raises the awareness ceiling slightly (people believe you faster).
export function trustAwarenessLift(w: World, cellIndex: number): number {
  return 1 + getEquity(w, cellIndex).trust * 0.25;
}

// Per-tick equity update for a touched cell. brandPower 0..~1 (scaled brand-marketing spend),
// focusMatch concentrates it. `signals` are the EARNED targets from current strategy.
export function updateEquity(
  w: World, cellIndex: number, brandPower: number, focusMatch: number,
  signals: { prestige: number; value: number; trust: number; innovation: number }
) {
  const cur = w.brandEquity[cellIndex] ?? { ...ZERO };
  // brand marketing pushes toward the earned signal targets; without spend, equity slowly decays.
  const drive = clamp(0.004 * (0.4 + brandPower * focusMatch));
  const decay = 0.0012;
  const step = (val: number, target: number) => clamp(val + (target - val) * drive - val * (target < val ? 0 : 0) - (brandPower < 0.05 ? val * decay : 0), 0, 1);
  w.brandEquity[cellIndex] = {
    trust: step(cur.trust, signals.trust),
    prestige: step(cur.prestige, signals.prestige),
    value: step(cur.value, signals.value),
    innovation: step(cur.innovation, signals.innovation),
  };
}

// Compute the EARNED equity signal targets from the player's current strategy (pricing/quality/channels/attrs).
// This is what brand marketing pushes equity toward — your actions define the brand, marketing amplifies it.
export function earnedSignals(w: World): { prestige: number; value: number; trust: number; innovation: number } {
  const skus = w.player.skus;
  if (skus.length === 0) return { prestige: 0.2, value: 0.4, trust: 0.3, innovation: 0.3 };
  const avgPrice = sum(skus.map((s) => s.listPrice)) / skus.length;
  const avgQuality = sum(skus.map((s) => s.quality)) / skus.length;
  const avgOnline = sum(skus.map((s) => s.online)) / skus.length;
  // price relative to a 45 reference → prestige vs value
  const priceLevel = clamp((avgPrice / 45 - 0.6) / 1.2, 0, 1); // 0 cheap .. 1 expensive
  // channel mix: flagship/ownweb build prestige; marketplace erodes it
  const allCh = skus.flatMap((s) => s.channels);
  const flagshipShare = allCh.length ? allCh.filter((c) => c === "flagship").length / allCh.length : 0;
  const marketplaceShare = allCh.length ? allCh.filter((c) => c === "marketplace").length / allCh.length : 0;
  const innovationAttr = (() => {
    // innovation comes from scientific/techy-style attributes + online readiness
    const sci = sum(skus.map((s) => (s.attributes["scientific"] ?? 0) + (s.attributes["creative"] ?? 0))) / skus.length;
    return clamp(0.3 + sci * 0.4 + avgOnline * 0.3, 0, 1);
  })();
  return {
    prestige: clamp(priceLevel * 0.7 + flagshipShare * 0.4 - marketplaceShare * 0.3, 0, 1),
    value: clamp((1 - priceLevel) * 0.8 + marketplaceShare * 0.2, 0, 1),
    trust: clamp(0.25 + avgQuality * 0.7, 0, 1),
    innovation: innovationAttr,
  };
}

// New-product launch head-start: a fresh SKU inherits a fraction of the brand's per-cell equity,
// expressed as a starting awareness bump (credibility → faster initial adoption).
export function launchInheritance(w: World, cellIndex: number): number {
  const e = getEquity(w, cellIndex);
  const strength = (e.trust + e.prestige + e.innovation) / 3;
  return clamp(strength * 0.4, 0, 0.4); // up to +0.4 starting awareness in cells where the brand is strong
}
