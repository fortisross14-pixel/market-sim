import type { World, Brand, SKU, Competitor, AxisKey } from "./types";
import { INDUSTRIES, AXES, axisPos } from "./industries";
import { buildCube } from "./cube";
import { deriveUnitCost, deriveQuality } from "./economics";
import { presetSegments } from "./segments";

export const STUDY_DEFS: Record<string, { label: string; cost: number; ticks: number; blurb: string }> = {
  market_map: { label: "Population Map Scan", cost: 60000, ticks: 14, blurb: "Reveals headcount + spend across the whole cube." },
  gap_analysis: { label: "Gap Analysis", cost: 90000, ticks: 18, blurb: "Finds cells with high market but weak brand fit — niches." },
  competitor_benchmark: { label: "Competitor Benchmark", cost: 120000, ticks: 24, blurb: "Rivals' price, personality & margin vs. yours." },
  product_diagnosis: { label: "Product Diagnosis", cost: 80000, ticks: 16, blurb: "For each product: its best-fit segment and whether channel or packaging is holding it back." },
};

export function initWorld(industryId: string, company: string, brand: Brand, startCash: number): World {
  const cfg = INDUSTRIES[industryId];
  const cube = buildCube(cfg);
  const comps: Competitor[] = cfg.competitors.map((c, i) => ({
    id: "C" + i, name: c.name, target: c.target, quality: c.quality,
    price: c.price, basePrice: c.price, priceSens: c.priceSens, strength: c.strength,
    isComp: true, personality: c.personality ?? "balanced",
    products: [{
      target: c.target, quality: c.quality, price: c.price, basePrice: c.price,
      priceSens: c.priceSens, awarenessKey: `C${i}_p0`, attributes: { ...c.attributes },
      productKey: cfg.products[Math.min(i, cfg.products.length - 1)].key,
    }],
    marketing: 80_000, marketingFocus: "all", cash: 1_000_000, exitedCells: [],
    actionCooldown: 0, threatMemory: {},
  }));
  for (const cell of cube) for (const c of comps) cell.awareness[c.products[0].awarenessKey] = c.strength * 0.9;

  return {
    industryId, cfg, tick: 0, company, brand, cube, comps,
    player: {
      skus: [], contracts: [], marketing: 60000, marketingTarget: 60000, marketingFocus: "all",
      brandMarketing: 0, brandMarketingTarget: 0,
      backOffice: 70000, backOfficeTarget: 70000, cash: startCash, debt: 0, lostSales: 0, receivables: [],
    },
    studies: [], revealed: {}, history: [], events: [],
    pendingShockTick: 80 + Math.floor(Math.random() * 80), shock: null,
    live: null, selectedCell: null, selectedInfo: null,
    fitCache: {}, fitCacheDirty: true,
    savedSegments: presetSegments(),
    brandEquity: {},
    customers: {},
  };
}

export interface ProductSpec {
  name: string; productKey: string; method: "outsource" | "own";
  materialsQ: number; productionQ: number; online: number; listPrice: number; batch: number;
  gAge: number; gClass: number; gGender: number; gLeaning: number;
  gGeography?: number; gFamily?: number;
  attributes: Record<string, number>; // need vector chosen in the creator
  packaging?: string; channels?: import("./types").ChannelType[];
}

export function buildSku(cfg: World["cfg"], spec: ProductSpec, id: string): SKU {
  const pt = cfg.products.find((p) => p.key === spec.productKey)!;
  const unitCost = deriveUnitCost(pt, spec.method, spec.materialsQ, spec.productionQ);
  const quality = deriveQuality(spec.materialsQ, spec.productionQ);
  return {
    id, name: spec.name, productKey: spec.productKey, method: spec.method,
    target: { gender: spec.gGender, age: spec.gAge, class: spec.gClass, leaning: spec.gLeaning, geography: spec.gGeography ?? 0.5, family: spec.gFamily ?? 0.5 },
    quality, unitCost, listPrice: spec.listPrice, priceSens: 1.0, inventory: spec.batch, online: spec.online,
    attributes: { ...spec.attributes },
    packaging: spec.packaging ?? "minimal",
    channels: spec.channels ? [...spec.channels] : [],
  };
}

export const normAxis = (axis: AxisKey, val: string) => axisPos(axis, AXES[axis].indexOf(val));
