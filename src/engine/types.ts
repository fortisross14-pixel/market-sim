// ============================================================================
// Domain types. Money is in whole currency units (dollars). Units are item counts.
// "PerQuarter" quantities are run-rates; the tick loop slices them by TICKS_PER_QUARTER.
// ============================================================================

export const TICKS_PER_QUARTER = 24;
export const TICKS_PER_YEAR = TICKS_PER_QUARTER * 4;

export type AxisKey = "gender" | "age" | "class" | "leaning" | "geography" | "family";

export interface Coord {
  gender: string;
  age: string;
  class: string;
  leaning: string;
  geography: string;
  family: string;
}

export interface Cell {
  coord: Coord;
  head: number; // people
  baseHead: number;
  spend: number; // avg annual spend in this industry, $/person/yr
  awareness: Record<string, number>; // productId -> 0..1
  needPref: Record<string, number>; // need key -> 0..1 preference weight (sums ~1)
  // rich frozen attributes (set at start, re-rolled only at year-end / events)
  qualitySens: number; // 0..1: how much this segment rewards quality
  priceSens: number;   // 0..2: how much a high price repels this segment
  categoryPref: Record<string, number>; // productType key -> 0..1 affinity (e.g. boys love action figures)
  channelPref: Record<string, number>; // ChannelType -> 0..1 how much this segment shops there
  equityPref: Record<string, number>; // brand metric (trust/prestige/value/innovation) -> 0..1 how much this segment cares
}

export interface NeedAxis {
  key: string;
  label: string;
  // how this need correlates with demographic axes (used to seed cell preferences)
  // e.g. Luxury correlates positively with class; Value negatively.
  lean: Partial<Record<AxisKey, number>>; // -1..1 per demographic axis
}

export interface IndustryConfig {
  id: string;
  label: string;
  currency: string;
  axisWeight: Record<AxisKey, number>;
  spend: {
    class: Record<string, number>;
    gender: Record<string, number>;
    age: Record<string, number>;
  };
  products: ProductType[];
  competitors: CompetitorSeed[];
  thirdAxisLabel: string;
  needs: NeedAxis[];
}

export interface ProductType {
  key: string;
  label: string;
  baseCost: number;
  priceBand: [number, number];
  // natural demographic lean of this product type (cube coords 0..1), optional.
  // If present, fit blends the player's chosen target with the type's lean.
  naturalLean?: Partial<Record<AxisKey, number>>;
  // default need-attribute vector for this product type (0..1 per need key)
  defaultAttributes?: Record<string, number>;
  // who is naturally inclined to this CATEGORY (affinity lean per demographic axis, -1..1).
  // e.g. action figures: young + male; anti-aging: older. Drives categoryPref per segment.
  categoryLean?: Partial<Record<AxisKey, number>>;
}

export interface CompetitorSeed {
  name: string;
  target: Record<AxisKey, number>;
  quality: number;
  price: number;
  priceSens: number;
  strength: number;
  personality?: CompetitorPersonality;
  attributes: Record<string, number>; // need vector
}

export type CompetitorPersonality = "discounter" | "premium" | "balanced";

export interface CompetitorProduct {
  target: Record<AxisKey, number>;
  quality: number;
  price: number;
  basePrice: number;
  priceSens: number;
  awarenessKey: string; // unique id used in cell.awareness map
  attributes: Record<string, number>; // need vector
  productKey: string; // category
}

export interface Competitor {
  id: string;
  name: string;
  // primary product kept at top level for back-compat with price-reaction code
  target: Record<AxisKey, number>;
  quality: number;
  price: number;
  basePrice: number;
  priceSens: number;
  strength: number;
  isComp: true;
  personality: CompetitorPersonality;
  // M2 additions
  products: CompetitorProduct[];
  marketing: number;       // their per-quarter marketing spend
  marketingFocus: string;  // age band they emphasize, or "all"
  cash: number;
  lastAction?: string;
  exitedCells: string[];   // coord keys they've abandoned
  actionCooldown: number;  // ticks until next strategic action allowed
  threatMemory: Record<string, number>; // coordKey -> consecutive quarters player has dominated
}

export type ProductMethod = "outsource" | "own";

export interface SKU {
  id: string;
  name: string;
  productKey: string;
  method: ProductMethod;
  target: Record<AxisKey, number>;
  quality: number;
  unitCost: number;
  listPrice: number;
  priceSens: number;
  inventory: number; // units in stock
  online: number; // 0..1 online readiness
  attributes: Record<string, number>; // need vector (0..1 per need key)
  packaging: string; // packaging preset key
  channels: ChannelType[]; // which company channels carry THIS product
}

export type ChannelType = "retail" | "marketplace" | "ownweb" | "flagship";

export interface ChannelDef {
  label: string;
  baseReach: number;
  marginCut: number; // retailer's cut of gross
  slotting: number; // $/quarter fixed
  awarenessBoost: number;
  online: number;
  paymentDays: number; // how long until you get paid through this channel
}

export interface Contract {
  type: ChannelType;
  marginCut: number; // negotiated
}

// ---- Finance (Milestone 1) ----
export interface CellFinance {
  coord: Coord;
  revenue: number; // net of channel cut, $/quarter
  units: number; // $/quarter rate
  grossMargin: number; // revenue - COGS
  marketingAllocated: number; // CAC allocated to this cell
  contribution: number; // grossMargin - marketingAllocated
}

export interface IncomeStatement {
  grossRevenue: number;
  channelCut: number;
  netRevenue: number;
  cogs: number;
  contribution: number;
  marketing: number;
  brandMarketing: number;
  slotting: number;
  backOffice: number;
  ebitda: number;
  interest: number;
  profit: number;
}

export interface CashFlow {
  cash: number;
  inventoryValue: number; // cash tied up in unsold stock
  receivables: number; // cash owed to us, in transit through payment delays
  cashCycleDays: number;
  operatingCashFlow: number; // per quarter
  debt: number;
}

export interface Receivable {
  amount: number;
  dueTick: number;
}

export interface SkuResult {
  units: number;
  revenue: number; // net
  gross: number;
  margin: number;
  inventory: number;
}

export interface Study {
  type: string;
  ticksLeft: number;
  done: boolean;
}

export interface MarketEvent {
  tick: number;
  kind: string;
  text: string;
}

export interface Brand {
  name: string;
  color: string;
  positioning: string;
}

export interface PlayerState {
  skus: SKU[];
  contracts: Contract[];
  marketing: number;
  marketingTarget: number;
  marketingFocus: string;
  brandMarketing: number;        // smoothed current brand-marketing spend
  brandMarketingTarget: number;  // builds equity, not awareness
  backOffice: number;
  backOfficeTarget: number;
  cash: number;
  debt: number;
  lostSales: number;
  receivables: Receivable[];
}

export interface LiveSnapshot {
  income: IncomeStatement;
  cashflow: CashFlow;
  cellFinance: CellFinance[];
  skuResults: SkuResult[];
  totalUnits: number;
  overallShare: number;
  totalMarket: number;
  totalReach: number;
  onlineCoverage: number;
  avgMarginCut: number;
}

export interface HistoryPoint {
  tick: number;
  quarter: number;
  revenue: number;
  profit: number;
  share: number;
  cash: number;
  operatingCashFlow: number;
}

export interface World {
  industryId: string;
  cfg: IndustryConfig;
  tick: number;
  company: string;
  brand: Brand;
  cube: Cell[];
  comps: Competitor[];
  player: PlayerState;
  studies: Study[];
  revealed: Record<string, any>;
  history: HistoryPoint[];
  events: MarketEvent[];
  pendingShockTick: number;
  shock: { type: string; dir?: string; ticksLeft: number } | null;
  live: LiveSnapshot | null;
  selectedCell: Coord | null;
  selectedInfo: any;
  // perf: cached static appeal factor (demoFit × needMatch × categoryPref) per "skuId|cellIndex".
  // recomputed only when products change or segments re-roll, NOT every tick.
  fitCache: Record<string, number[]>;
  fitCacheDirty: boolean;
  savedSegments: import("./segments").SavedSegment[];
  // brand equity per cell index: { trust, prestige, value, innovation } each 0..1.
  // distinct from awareness — "what they believe" vs "do they know us". Sparse: only cells we've touched.
  brandEquity: Record<number, { trust: number; prestige: number; value: number; innovation: number }>;
  // customer base per cell index: how many people in that segment are "ours", and how satisfied.
  // Sparse — only cells we've acquired customers in. customers ≤ cell.head.
  customers: Record<number, { count: number; satisfaction: number }>;
}
