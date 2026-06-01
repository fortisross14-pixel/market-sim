import type { IndustryConfig, ChannelDef, ChannelType, AxisKey } from "./types";

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const ease = (c: number, t: number, k: number) => c + (t - c) * k;
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const round = (v: number, d = 0) => { const p = 10 ** d; return Math.round(v * p) / p; };

export const AXES: Record<AxisKey, string[]> = {
  gender: ["Female", "Male"],
  age: ["13-24", "25-39", "40-59", "60+"],
  class: ["Budget", "Middle", "Affluent"],
  leaning: ["Progressive", "Neutral", "Conservative"],
  geography: ["Urban", "Suburban", "Rural"],
  family: ["Single", "Couple", "Family"],
};
export const AXIS_KEYS = Object.keys(AXES) as AxisKey[];
export const axisPos = (axis: AxisKey, idx: number) => {
  const n = AXES[axis].length;
  return n === 1 ? 0.5 : idx / (n - 1);
};

export const POSITIONINGS = [
  { key: "mass", label: "Mass Market", blurb: "Wide, price-sensitive. Volume game." },
  { key: "premium", label: "Premium", blurb: "Quality-led, healthy margin." },
  { key: "luxury", label: "Luxury", blurb: "Exclusive, top quality demanded." },
];
export const BRAND_COLORS = ["#34c3ff", "#a78bfa", "#3fd07f", "#ffb340", "#ff5d6c", "#f472b6", "#22d3ee", "#facc15"];

// Channels carry payment delays now (Milestone 1: cash != profit)
export const CHANNEL_TYPES: Record<ChannelType, ChannelDef> = {
  retail:      { label: "Dept / Big-Box Retail", baseReach: 0.75, marginCut: 0.40, slotting: 60000, awarenessBoost: 0.5, online: 0.1, paymentDays: 90 },
  marketplace: { label: "Marketplace (Amazon)",   baseReach: 0.65, marginCut: 0.25, slotting: 15000, awarenessBoost: 0.35, online: 1.0, paymentDays: 14 },
  ownweb:      { label: "Own E-commerce",         baseReach: 0.25, marginCut: 0.05, slotting: 20000, awarenessBoost: 0.15, online: 1.0, paymentDays: 0 },
  flagship:    { label: "Flagship Store",         baseReach: 0.20, marginCut: 0.10, slotting: 120000, awarenessBoost: 1.0, online: 0.0, paymentDays: 2 },
};

export const METHODS = {
  outsource: { label: "Outsource", mult: 1.35, available: true, note: "Higher per-unit, no setup, ships now." },
  own:       { label: "Own Production", mult: 0.85, available: false, note: "Cheaper per unit — needs factory capacity (none yet)." },
};

export const INDUSTRIES: Record<string, IndustryConfig> = {
  skincare: {
    id: "skincare", label: "Skincare", currency: "$",
    axisWeight: { gender: 0.30, age: 1.0, class: 0.9, leaning: 0.12, geography: 0.25, family: 0.2 },
    spend: {
      class: { Budget: 90, Middle: 240, Affluent: 520 },
      gender: { Female: 1.0, Male: 0.45 },
      age: { "13-24": 0.8, "25-39": 1.3, "40-59": 1.1, "60+": 0.7 },
    },
    products: [
      { key: "moisturizer", label: "Moisturizer", baseCost: 6, priceBand: [18, 60], defaultAttributes: { luxury: 0.4, scientific: 0.4, natural: 0.4, sensitive: 0.4, value: 0.5 } },
      { key: "serum", label: "Serum", baseCost: 9, priceBand: [28, 95], defaultAttributes: { luxury: 0.6, scientific: 0.7, natural: 0.3, sensitive: 0.3, value: 0.3 } },
      { key: "cleanser", label: "Cleanser", baseCost: 4, priceBand: [12, 38], defaultAttributes: { luxury: 0.2, scientific: 0.4, natural: 0.5, sensitive: 0.5, value: 0.7 } },
      // anti-aging naturally leans older; hydration leans younger — product TYPE carries demographic pull
      { key: "antiaging", label: "Anti-Aging Cream", baseCost: 11, priceBand: [35, 120], naturalLean: { age: 0.85 }, defaultAttributes: { luxury: 0.7, scientific: 0.8, natural: 0.2, sensitive: 0.3, value: 0.2 }, categoryLean: { age: 0.8, class: 0.3 } },
      { key: "hydration", label: "Hydration Gel", baseCost: 6, priceBand: [16, 50], naturalLean: { age: 0.2 }, defaultAttributes: { luxury: 0.3, scientific: 0.4, natural: 0.6, sensitive: 0.6, value: 0.6 }, categoryLean: { age: -0.5 } },
    ],
    competitors: [
      { name: "Lumière", target: { gender: 0.30, age: 0.70, class: 0.85, leaning: 0.5, geography: 0.5, family: 0.5 }, quality: 0.70, price: 46, priceSens: 0.9, strength: 0.8, personality: "premium", attributes: { luxury: 0.85, scientific: 0.5, natural: 0.3, sensitive: 0.3, value: 0.2 } },
      { name: "DermaPure", target: { gender: 0.30, age: 0.85, class: 0.80, leaning: 0.5, geography: 0.5, family: 0.5 }, quality: 0.80, price: 55, priceSens: 0.7, strength: 0.75, personality: "balanced", attributes: { luxury: 0.4, scientific: 0.9, natural: 0.2, sensitive: 0.6, value: 0.3 } },
    ],
    thirdAxisLabel: "Compact Pack",
    needs: [
      { key: "luxury", label: "Luxury", lean: { class: 0.7, age: 0.2 } },
      { key: "scientific", label: "Scientific", lean: { class: 0.4, age: 0.3 } },
      { key: "natural", label: "Natural", lean: { leaning: -0.4, age: -0.2 } },
      { key: "sensitive", label: "Sensitive Skin", lean: { age: 0.3 } },
      { key: "value", label: "Value", lean: { class: -0.8 } },
    ],
  },
  toys: {
    id: "toys", label: "Toys", currency: "$",
    axisWeight: { gender: 0.20, age: 1.2, class: 0.7, leaning: 0.10, geography: 0.15, family: 0.5 },
    spend: {
      class: { Budget: 120, Middle: 260, Affluent: 480 },
      gender: { Female: 0.9, Male: 1.0 },
      age: { "13-24": 0.7, "25-39": 1.4, "40-59": 1.0, "60+": 0.5 },
    },
    products: [
      { key: "buildingset", label: "Building Set", baseCost: 4, priceBand: [12, 45], defaultAttributes: { educational: 0.7, creative: 0.7, licensed: 0.2, collectible: 0.3, social: 0.3 } },
      { key: "boardgame", label: "Board Game", baseCost: 3, priceBand: [10, 35], defaultAttributes: { educational: 0.5, creative: 0.4, licensed: 0.2, collectible: 0.2, social: 0.9 } },
      { key: "plush", label: "Plush Toy", baseCost: 2, priceBand: [8, 28], naturalLean: { age: 0.1 }, defaultAttributes: { educational: 0.2, creative: 0.3, licensed: 0.6, collectible: 0.5, social: 0.3 }, categoryLean: { age: -0.6, family: 0.4 } },
      { key: "actionfig", label: "Action Figure", baseCost: 3, priceBand: [9, 30], defaultAttributes: { educational: 0.1, creative: 0.3, licensed: 0.8, collectible: 0.8, social: 0.2 }, categoryLean: { age: -0.5, gender: 0.6, family: 0.3 } },
    ],
    competitors: [
      { name: "FunForge", target: { gender: 0.5, age: 0.45, class: 0.5, leaning: 0.5, geography: 0.5, family: 0.5 }, quality: 0.72, price: 25, priceSens: 1.1, strength: 0.8, personality: "balanced", attributes: { educational: 0.6, creative: 0.6, licensed: 0.3, collectible: 0.3, social: 0.5 } },
      { name: "ToyWorks", target: { gender: 0.5, age: 0.55, class: 0.35, leaning: 0.5, geography: 0.5, family: 0.5 }, quality: 0.70, price: 20, priceSens: 1.3, strength: 0.7, personality: "discounter", attributes: { educational: 0.3, creative: 0.4, licensed: 0.7, collectible: 0.5, social: 0.4 } },
    ],
    thirdAxisLabel: "Brand/License",
    needs: [
      { key: "educational", label: "Educational", lean: { class: 0.5, age: 0.2 } },
      { key: "creative", label: "Creative", lean: { class: 0.3 } },
      { key: "licensed", label: "Licensed", lean: { class: -0.2, age: -0.3 } },
      { key: "collectible", label: "Collectible", lean: { age: -0.2 } },
      { key: "social", label: "Social", lean: { age: -0.1 } },
    ],
  },
};

// Packaging presets (Release: per-product distribution). Each carries:
//  - needBias: which product NEED attributes it amplifies in the buyer's eyes
//  - ageLean: -1 (skews young) .. +1 (skews older) demographic resonance
//  - classLean: -1 (budget vibe) .. +1 (premium vibe)
export interface PackagingPreset {
  key: string; label: string;
  needBias: Record<string, number>; // partial; multiplies perceived need attributes
  ageLean: number; classLean: number;
}
export const PACKAGING: PackagingPreset[] = [
  { key: "bold",      label: "Bold & Graphic",     needBias: {}, ageLean: -0.6, classLean: -0.1 },
  { key: "colorful",  label: "Colorful & Playful",  needBias: {}, ageLean: -0.8, classLean: -0.3 },
  { key: "minimal",   label: "Minimal & Clean",     needBias: {}, ageLean: -0.1, classLean: 0.4 },
  { key: "serious",   label: "Serious & Clinical",  needBias: {}, ageLean: 0.5, classLean: 0.3 },
  { key: "premium",   label: "Premium & Luxe",      needBias: {}, ageLean: 0.3, classLean: 0.8 },
  { key: "natural",   label: "Natural & Earthy",    needBias: {}, ageLean: 0.0, classLean: 0.0 },
  { key: "retro",     label: "Retro & Nostalgic",   needBias: {}, ageLean: 0.4, classLean: -0.1 },
  { key: "techy",     label: "Sleek & High-Tech",   needBias: {}, ageLean: -0.2, classLean: 0.4 },
];
// per-industry need amplification for packaging (filled here so needBias stays industry-aware)
export function packagingNeedBias(industryId: string, key: string): Record<string, number> {
  if (industryId === "skincare") {
    const map: Record<string, Record<string, number>> = {
      serious: { scientific: 1.3 }, premium: { luxury: 1.4 }, natural: { natural: 1.4, sensitive: 1.1 },
      minimal: { luxury: 1.15, scientific: 1.1 }, techy: { scientific: 1.25 }, colorful: { value: 1.1 },
      bold: { value: 1.05 }, retro: { natural: 1.1 },
    };
    return map[key] ?? {};
  }
  if (industryId === "toys") {
    const map: Record<string, Record<string, number>> = {
      colorful: { creative: 1.3, social: 1.1 }, bold: { licensed: 1.2, collectible: 1.1 },
      serious: { educational: 1.3 }, minimal: { educational: 1.15 }, premium: { collectible: 1.3 },
      retro: { collectible: 1.25 }, techy: { educational: 1.15, licensed: 1.1 }, natural: { creative: 1.1 },
    };
    return map[key] ?? {};
  }
  return {};
}

// ============================================================================
// Licensing — named IP-style licenses the player can attach to a product.
// Each license has a cost (annual royalty), a per-unit royalty, and a "pull"
// that boosts the licensed/collectible attributes + initial awareness.
// Category multiplier determines how much the license matters (huge for toys, modest for food).
// ============================================================================
export interface License {
  key: string;
  label: string;
  tier: "minor" | "major" | "mega";
  annualFee: number;    // flat $/yr royalty
  unitRoyalty: number;  // $/unit surcharge
  pull: number;         // 0..1 how much this license boosts licensed/collectible attributes
  categoryMult: Record<string, number>; // industry id -> how much this license matters there (default 1)
}

export const LICENSES: License[] = [
  // minor licenses ($20-60k/yr, low pull)
  { key: "indie_comics",   label: "Indie Comics Universe",     tier: "minor", annualFee: 25_000,  unitRoyalty: 0.30, pull: 0.25, categoryMult: { toys: 1.2, skincare: 0.3 } },
  { key: "retro_arcade",   label: "Retro Arcade Classics",     tier: "minor", annualFee: 30_000,  unitRoyalty: 0.25, pull: 0.30, categoryMult: { toys: 1.3, skincare: 0.2 } },
  { key: "nature_doc",     label: "Planet Wild (Nature Doc)",   tier: "minor", annualFee: 20_000,  unitRoyalty: 0.20, pull: 0.20, categoryMult: { toys: 0.8, skincare: 0.9 } },
  { key: "local_sport",    label: "National League (Local)",    tier: "minor", annualFee: 40_000,  unitRoyalty: 0.35, pull: 0.35, categoryMult: { toys: 1.0, skincare: 0.4 } },
  { key: "cooking_show",   label: "Master Kitchen (TV Show)",   tier: "minor", annualFee: 35_000,  unitRoyalty: 0.30, pull: 0.25, categoryMult: { toys: 0.5, skincare: 0.7 } },
  // major licenses ($80-200k/yr, medium pull)
  { key: "fantasy_saga",   label: "Realm of Crowns (Fantasy)",  tier: "major", annualFee: 120_000, unitRoyalty: 0.80, pull: 0.55, categoryMult: { toys: 1.4, skincare: 0.3 } },
  { key: "space_opera",    label: "Stellar Frontiers (Sci-Fi)", tier: "major", annualFee: 150_000, unitRoyalty: 0.90, pull: 0.60, categoryMult: { toys: 1.5, skincare: 0.2 } },
  { key: "animated_kids",  label: "Sunny Pals (Kids Animated)", tier: "major", annualFee: 100_000, unitRoyalty: 0.70, pull: 0.55, categoryMult: { toys: 1.6, skincare: 0.4 } },
  { key: "global_soccer",  label: "World Football League",      tier: "major", annualFee: 180_000, unitRoyalty: 1.00, pull: 0.60, categoryMult: { toys: 1.2, skincare: 0.5 } },
  { key: "global_basket",  label: "Pro Basketball Association",  tier: "major", annualFee: 160_000, unitRoyalty: 0.95, pull: 0.55, categoryMult: { toys: 1.1, skincare: 0.4 } },
  // mega licenses ($300k+/yr, high pull)
  { key: "superhero",      label: "Titan Heroes Universe",      tier: "mega",  annualFee: 350_000, unitRoyalty: 1.50, pull: 0.80, categoryMult: { toys: 1.8, skincare: 0.3 } },
  { key: "princess_magic", label: "Enchanted Kingdoms",          tier: "mega",  annualFee: 300_000, unitRoyalty: 1.40, pull: 0.75, categoryMult: { toys: 1.7, skincare: 0.5 } },
  { key: "racing_cars",    label: "Speedway Legends",            tier: "mega",  annualFee: 280_000, unitRoyalty: 1.20, pull: 0.70, categoryMult: { toys: 1.5, skincare: 0.2 } },
  { key: "monster_world",  label: "Creature Realms (Monsters)",  tier: "mega",  annualFee: 320_000, unitRoyalty: 1.30, pull: 0.75, categoryMult: { toys: 1.6, skincare: 0.2 } },
  { key: "pop_music",      label: "Global Pop Icons",            tier: "mega",  annualFee: 400_000, unitRoyalty: 1.60, pull: 0.85, categoryMult: { toys: 1.3, skincare: 0.7 } },
];
