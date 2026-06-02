import type { World, Brand, SKU, Competitor, AxisKey } from "./types";
import { computeProductRarity, DESIGN_DEPTHS } from "./types";
import { INDUSTRIES, AXES, axisPos, clamp } from "./industries";
import { buildCube } from "./cube";
import { deriveUnitCost, deriveQuality } from "./economics";
import { presetSegments } from "./segments";

export const STUDY_DEFS: Record<string, { label: string; cost: number; ticks: number; blurb: string }> = {
  market_map: { label: "Population Map Scan", cost: 60000, ticks: 14, blurb: "Reveals headcount + spend across the whole cube." },
  gap_analysis: { label: "Gap Analysis", cost: 90000, ticks: 18, blurb: "Finds cells with high market but weak brand fit — niches." },
  competitor_benchmark: { label: "Competitor Benchmark", cost: 120000, ticks: 24, blurb: "Rivals' price, personality & margin vs. yours." },
  product_diagnosis: { label: "Product Diagnosis", cost: 80000, ticks: 16, blurb: "For each product: its best-fit segment and whether channel or packaging is holding it back." },
  market_report: { label: "Market Report", cost: 150000, ticks: 30, blurb: "Category growth, competitor count, market concentration (top-3 share, who controls 60%), and directional trends." },
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
      financeDept: 0, intelDept: 0,
      locations: [
        { id: "off0", type: "office", tier: 0, monthlyCost: 8_000 },
        { id: "wh0", type: "warehouse", tier: 0, monthlyCost: 5_000 },
      ],
      personnel: [],
      expertise: { industry: {}, category: {} },
      vision: null,
    },
    studies: [], revealed: {}, history: [], events: [],
    pendingShockTick: 80 + Math.floor(Math.random() * 80), shock: null,
    live: null, selectedCell: null, selectedInfo: null,
    fitCache: {}, fitCacheDirty: true,
    savedSegments: presetSegments(),
    brandEquity: {},
    customers: {},
    activeCampaigns: [],
    agencyRelationships: {},
    unitsTickHistory: [], marketTickHistory: [],
  };
}

export interface ProductSpec {
  name: string; productKey: string; method: "outsource" | "own";
  materialsQ: number; productionQ: number; online: number; listPrice: number;
  gAge: number; gClass: number; gGender: number; gLeaning: number;
  gGeography?: number; gFamily?: number;
  attributes: Record<string, number>;
  packaging?: string; channels?: import("./types").ChannelType[];
  pmSkill?: number;
  pmId?: string;
  designDepth?: import("./types").DesignDepth;
}

export function buildSku(cfg: World["cfg"], spec: ProductSpec, id: string, tick = 0, expertise = 0): SKU {
  const pt = cfg.products.find((p) => p.key === spec.productKey)!;
  const unitCost = deriveUnitCost(pt, spec.method, spec.materialsQ, spec.productionQ);
  const quality = deriveQuality(spec.materialsQ, spec.productionQ);
  const depth = spec.designDepth ?? "normal";
  const depthDef = DESIGN_DEPTHS[depth];
  const attrSpread = Object.values(spec.attributes).length > 0
    ? Math.max(...Object.values(spec.attributes)) - Math.min(...Object.values(spec.attributes))
    : 0;
  const designQuality = clamp((0.2 + attrSpread * 0.3 + (spec.pmSkill ?? 0.2) * 0.3 + expertise * 0.04) * depthDef.qualityMult, 0, 1);
  const rarityScore = quality * 0.3 + designQuality * 0.4 + expertise * 0.06;
  return {
    id, name: spec.name, productKey: spec.productKey, method: spec.method,
    target: { gender: spec.gGender, age: spec.gAge, class: spec.gClass, leaning: spec.gLeaning, geography: spec.gGeography ?? 0.5, family: spec.gFamily ?? 0.5 },
    // lifecycle: starts in "designing" state, no inventory, PM locked
    status: "designing",
    assignedPmId: spec.pmId ?? null,
    designDepth: depth,
    designDaysLeft: depthDef.days,
    mfgDaysLeft: 0,
    mfgBatchSize: 0,
    // quality
    quality, designQuality, perceivedQuality: quality,
    novelty: 1.0, fame: 0, rarity: computeProductRarity(rarityScore),
    lifetimeDays: pt.lifetimeDays, launchTick: 0, // set when first manufactured
    // economics: zero inventory until manufactured
    unitCost, listPrice: spec.listPrice, priceSens: 1.0, inventory: 0, online: spec.online,
    unitsSoldTotal: 0, contributionTotal: 0,
    attributes: spec.attributes, packaging: spec.packaging ?? "standard",
    channels: spec.channels ?? [], assignedPartnerIds: [], license: null,
  };
}

export const normAxis = (axis: AxisKey, val: string) => axisPos(axis, AXES[axis].indexOf(val));
