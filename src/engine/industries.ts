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
    axisWeight: { gender: 0.30, age: 1.0, class: 0.9, leaning: 0.12 },
    spend: {
      class: { Budget: 90, Middle: 240, Affluent: 520 },
      gender: { Female: 1.0, Male: 0.45 },
      age: { "13-24": 0.8, "25-39": 1.3, "40-59": 1.1, "60+": 0.7 },
    },
    products: [
      { key: "moisturizer", label: "Moisturizer", baseCost: 6, priceBand: [18, 60] },
      { key: "serum", label: "Serum", baseCost: 9, priceBand: [28, 95] },
      { key: "cleanser", label: "Cleanser", baseCost: 4, priceBand: [12, 38] },
      // anti-aging naturally leans older; hydration leans younger — product TYPE carries demographic pull
      { key: "antiaging", label: "Anti-Aging Cream", baseCost: 11, priceBand: [35, 120], naturalLean: { age: 0.85 } },
      { key: "hydration", label: "Hydration Gel", baseCost: 6, priceBand: [16, 50], naturalLean: { age: 0.2 } },
    ],
    competitors: [
      { name: "Lumière", target: { gender: 0.30, age: 0.70, class: 0.85, leaning: 0.5 }, quality: 0.70, price: 46, priceSens: 0.9, strength: 0.8, personality: "premium" },
      { name: "DermaPure", target: { gender: 0.30, age: 0.85, class: 0.80, leaning: 0.5 }, quality: 0.80, price: 55, priceSens: 0.7, strength: 0.75, personality: "balanced" },
    ],
    thirdAxisLabel: "Compact Pack",
  },
  toys: {
    id: "toys", label: "Toys", currency: "$",
    axisWeight: { gender: 0.20, age: 1.2, class: 0.7, leaning: 0.10 },
    spend: {
      class: { Budget: 120, Middle: 260, Affluent: 480 },
      gender: { Female: 0.9, Male: 1.0 },
      age: { "13-24": 0.7, "25-39": 1.4, "40-59": 1.0, "60+": 0.5 },
    },
    products: [
      { key: "buildingset", label: "Building Set", baseCost: 4, priceBand: [12, 45] },
      { key: "boardgame", label: "Board Game", baseCost: 3, priceBand: [10, 35] },
      { key: "plush", label: "Plush Toy", baseCost: 2, priceBand: [8, 28], naturalLean: { age: 0.1 } },
      { key: "actionfig", label: "Action Figure", baseCost: 3, priceBand: [9, 30] },
    ],
    competitors: [
      { name: "FunForge", target: { gender: 0.5, age: 0.45, class: 0.5, leaning: 0.5 }, quality: 0.72, price: 25, priceSens: 1.1, strength: 0.8, personality: "balanced" },
      { name: "ToyWorks", target: { gender: 0.5, age: 0.55, class: 0.35, leaning: 0.5 }, quality: 0.70, price: 20, priceSens: 1.3, strength: 0.7, personality: "discounter" },
    ],
    thirdAxisLabel: "Brand/License",
  },
};
