// ============================================================================
// Domain types. Money is in whole currency units (dollars). Units are item counts.
// One TICK = one day. Months are 30 days, quarters 90, years 360 (clean calendar).
// "PerQuarter" quantities are run-rates; the loop slices them by TICKS_PER_QUARTER.
// ============================================================================

export const TICKS_PER_DAY = 1;
export const DAYS_PER_MONTH = 30;
export const TICKS_PER_MONTH = 30;
export const TICKS_PER_QUARTER = 90;
export const TICKS_PER_YEAR = 360;
// Per-tick easing rates were tuned at 24 ticks/quarter. With 90 now, scale them so the
// per-quarter behaviour (how fast awareness/equity/customers move) stays balanced.
export const TICK_RATE_SCALE = 24 / TICKS_PER_QUARTER;

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
  lifetimeDays: number; // how long novelty lasts (360=1yr, 3600=10yr, 36000=100yr like Coke)
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

export type ProductRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const PRODUCT_RARITY_DEFS: Record<ProductRarity, { label: string; color: string; minScore: number }> = {
  common:    { label: "Common",    color: "#9ca3af", minScore: 0 },
  uncommon:  { label: "Uncommon",  color: "#34d399", minScore: 0.25 },
  rare:      { label: "Rare",      color: "#38bdf8", minScore: 0.45 },
  epic:      { label: "Epic",      color: "#c084fc", minScore: 0.65 },
  legendary: { label: "Legendary", color: "#fbbf24", minScore: 0.82 },
};

export function computeProductRarity(score: number): ProductRarity {
  if (score >= 0.82) return "legendary";
  if (score >= 0.65) return "epic";
  if (score >= 0.45) return "rare";
  if (score >= 0.25) return "uncommon";
  return "common";
}

export type ProductStatus = "designing" | "designed" | "manufacturing" | "active";
export type DesignDepth = "quick" | "normal" | "detailed";

export const DESIGN_DEPTHS: Record<DesignDepth, { label: string; days: number; qualityMult: number; desc: string }> = {
  quick:    { label: "Quick",    days: 14,  qualityMult: 0.7, desc: "2 weeks. Lower design quality but fast to market." },
  normal:   { label: "Normal",   days: 45,  qualityMult: 1.0, desc: "6 weeks. Balanced quality and speed." },
  detailed: { label: "Detailed", days: 90,  qualityMult: 1.3, desc: "3 months. Highest design quality, slow." },
};

export interface SKU {
  id: string;
  name: string;
  productKey: string;
  method: ProductMethod;
  target: Record<AxisKey, number>;
  // lifecycle status
  status: ProductStatus;
  assignedPmId: string | null;
  designDepth: DesignDepth;
  designDaysLeft: number;    // counts down during "designing"
  mfgDaysLeft: number;       // counts down during "manufacturing"
  mfgBatchSize: number;      // units being manufactured in current batch
  // quality
  quality: number;          // manufacturing quality (materials + production)
  designQuality: number;   // from design decisions + PM skill + depth
  perceivedQuality: number; // what the market believes
  novelty: number;         // 0..1, starts high, decays over product lifetime
  fame: number;            // 0..1, grows with sales + marketing + satisfaction
  rarity: ProductRarity;   // derived from quality + design + novelty + fame + expertise
  lifetimeDays: number;    // how long until novelty fully decays
  launchTick: number;      // when the product started selling (set when first manufactured)
  // economics
  unitCost: number;
  listPrice: number;
  priceSens: number;
  inventory: number;
  online: number;
  attributes: Record<string, number>;
  packaging: string;
  channels: ChannelType[];
  assignedPartnerIds: string[]; // which retail partners carry this product
  license: string | null;
  unitsSoldTotal: number;
  contributionTotal: number;
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
  partnerId: string;  // RETAIL_PARTNERS[].id
  partnerName: string;
  slotting: number;   // quarterly slotting from partner terms
  paymentDays: number;
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
  deptOverhead: number;
  licensingCost: number;
  locationCost: number;
  personnelCost: number;
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

// ---- Vision ----
export type VisionGoal = "quality" | "sales" | "recognition";
export interface Vision {
  goal: VisionGoal;           // best / most sold / most valued
  scope: string;              // industry id OR product key
  audience: string;           // "anyone" or a saved segment id
  audienceLabel: string;      // display name
  setTick: number;            // when this vision was set
  quartersPassed: number;     // how many full quarters since setTick (max 4)
}

export const VISION_GOALS: Record<VisionGoal, { label: string; adjective: string; bonusType: string; bonusMaxIndustry: number; bonusMaxProduct: number; desc: string }> = {
  quality:     { label: "Quality",     adjective: "best",       bonusType: "quality",     bonusMaxIndustry: 0.10, bonusMaxProduct: 0.20, desc: "design quality" },
  sales:       { label: "Sales",       adjective: "most sold",  bonusType: "sales",       bonusMaxIndustry: 0.10, bonusMaxProduct: 0.20, desc: "demand" },
  recognition: { label: "Recognition", adjective: "most valued", bonusType: "recognition", bonusMaxIndustry: 0.10, bonusMaxProduct: 0.20, desc: "brand equity gain" },
};

export type DeptTier = 0 | 1 | 2 | 3; // 0=none, 1=small, 2=medium, 3=large

// ---- Locations ----
export type LocationType = "office" | "warehouse" | "factory_onshore" | "factory_offshore";
export interface Location {
  id: string;
  type: LocationType;
  tier: number; // 0=small, 1=medium, 2=large
  monthlyCost: number;
}

export const LOCATION_DEFS: Record<LocationType, { label: string; tiers: { label: string; monthlyCost: number; setupCost: number; capacity: number; desc: string }[] }> = {
  office: { label: "Office", tiers: [
    { label: "Small Office", monthlyCost: 8_000, setupCost: 0, capacity: 2, desc: "Basic teams + up to 2 PM teams." },
    { label: "Medium Office", monthlyCost: 20_000, setupCost: 50_000, capacity: 5, desc: "Expanded teams, up to 5 PM teams." },
    { label: "Large Office", monthlyCost: 40_000, setupCost: 150_000, capacity: 10, desc: "Full departments, up to 10 PM teams." },
  ]},
  warehouse: { label: "Warehouse", tiers: [
    { label: "Small Warehouse", monthlyCost: 5_000, setupCost: 0, capacity: 3, desc: "Store up to 3 product lines." },
    { label: "Medium Warehouse", monthlyCost: 12_000, setupCost: 30_000, capacity: 7, desc: "Up to 7 product lines." },
    { label: "Large Warehouse", monthlyCost: 25_000, setupCost: 80_000, capacity: 12, desc: "Up to 12 product lines." },
  ]},
  factory_onshore: { label: "Factory (Onshore)", tiers: [
    { label: "Small Onshore", monthlyCost: 15_000, setupCost: 200_000, capacity: 50_000, desc: "50k units/month capacity. Higher quality." },
    { label: "Medium Onshore", monthlyCost: 30_000, setupCost: 400_000, capacity: 150_000, desc: "150k units/month." },
    { label: "Large Onshore", monthlyCost: 50_000, setupCost: 800_000, capacity: 400_000, desc: "400k units/month." },
  ]},
  factory_offshore: { label: "Factory (Offshore)", tiers: [
    { label: "Small Offshore", monthlyCost: 8_000, setupCost: 100_000, capacity: 80_000, desc: "80k units/month. Lower cost, lower quality ceiling." },
    { label: "Medium Offshore", monthlyCost: 18_000, setupCost: 250_000, capacity: 250_000, desc: "250k units/month." },
    { label: "Large Offshore", monthlyCost: 35_000, setupCost: 500_000, capacity: 600_000, desc: "600k units/month." },
  ]},
};

// ---- Personnel ----
export type PersonnelRole = "product_manager" | "finance" | "marketing" | "strategy" | "operations";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Personnel {
  id: string;
  name: string;
  role: PersonnelRole;
  rarity: Rarity;
  salary: number; // monthly
  skill: number;  // 0..1, drives quality/cost impact
}

export const RARITY_DEFS: Record<Rarity, { label: string; color: string; salaryMult: number; skillRange: [number, number] }> = {
  common:    { label: "Common",    color: "#9ca3af", salaryMult: 1.0, skillRange: [0.15, 0.35] },
  uncommon:  { label: "Uncommon",  color: "#34d399", salaryMult: 1.6, skillRange: [0.30, 0.50] },
  rare:      { label: "Rare",      color: "#38bdf8", salaryMult: 2.5, skillRange: [0.45, 0.65] },
  epic:      { label: "Epic",      color: "#c084fc", salaryMult: 4.0, skillRange: [0.60, 0.80] },
  legendary: { label: "Legendary", color: "#fbbf24", salaryMult: 7.0, skillRange: [0.80, 0.95] },
};

export const BASE_SALARIES: Record<PersonnelRole, number> = {
  product_manager: 6_000, finance: 4_500, marketing: 5_000, strategy: 5_500, operations: 4_000,
};

// ---- Expertise ----
// per industry + per product category, 0..5 stars, earned from cumulative sales
export interface Expertise {
  industry: Record<string, number>; // industry id -> 0..5
  category: Record<string, number>; // product key -> 0..5
}


export type OperatingRoomKind = "office" | "factory" | "warehouse" | "outsourcing";
export type OperatingTeamKind = "unassigned" | "product" | "marketing" | "finance" | "sales" | "operations" | "strategy";
export interface OperatingRoom {
  id: string;
  kind: OperatingRoomKind;
  x: number; y: number; w: number; h: number;
  name: string;
  team: OperatingTeamKind;
  productKey: string | null;
  skuId: string | null;
  assignedPersonnelIds: string[];
  buildCost: number;
  monthlyCost: number;
  capacity: number; // factory units/month; warehouse units; office seats; outsourcing supplier capacity
}

export interface PlayerState {
  skus: SKU[];
  contracts: Contract[];
  marketing: number;
  marketingTarget: number;
  marketingFocus: string;
  brandMarketing: number;
  brandMarketingTarget: number;
  backOffice: number;
  backOfficeTarget: number;
  cash: number;
  debt: number;
  lostSales: number;
  receivables: Receivable[];
  financeDept: DeptTier;
  intelDept: DeptTier;
  // new: organizational infrastructure
  locations: Location[];
  personnel: Personnel[];
  expertise: Expertise;
  vision: Vision | null;
  operatingRooms: OperatingRoom[];
}

export const DEPT_TIERS: { tier: DeptTier; label: string; cost: number; detail: string }[] = [
  { tier: 0, label: "None", cost: 0, detail: "Cash balance + quarterly totals only." },
  { tier: 1, label: "Small team", cost: 30_000, detail: "Monthly high-level summaries (revenue, costs, share)." },
  { tier: 2, label: "Department", cost: 80_000, detail: "Detailed by-SKU and by-segment breakdowns, weekly." },
  { tier: 3, label: "Full department", cost: 150_000, detail: "Everything, all charts, near-real-time (daily)." },
];

export interface LiveSnapshot {
  income: IncomeStatement;
  cashflow: CashFlow;
  cellFinance: CellFinance[];
  skuResults: SkuResult[];
  totalUnits: number;
  overallShare: number;       // instantaneous (this-tick run-rate) share
  shareMonth: number;         // share over the trailing 30 days (actual units / actual market)
  shareYear: number;          // share over the trailing 360 days
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

export interface Campaign {
  id: string;
  name: string;
  segmentId: string;     // saved segment id to target
  agencyId: string;      // which agency runs it
  budget: number;        // total spend
  daysRemaining: number; // ticks left
  totalDays: number;     // original duration
  effectivenessMult: number; // from agency
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
  // brand equity per CATEGORY per cell: brandEquity[productKey][cellIndex] = Equity.
  // Hot Wheels is big in toy cars, not in dolls. A new product inherits its own category's equity.
  brandEquity: Record<string, Record<number, { trust: number; prestige: number; value: number; innovation: number }>>;
  // customer base per cell index: how many people in that segment are "ours", and how satisfied.
  // Sparse — only cells we've acquired customers in. customers ≤ cell.head.
  customers: Record<number, { count: number; satisfaction: number }>;
  // rolling per-tick actual units sold and market consumed, for day/month/year share windows.
  // active one-off marketing campaigns (time-limited, segment-targeted awareness boosts)
  activeCampaigns: Campaign[];
  agencyRelationships: Record<string, number>; // agency id -> campaigns completed (builds trust)
  unitsTickHistory: number[];
  marketTickHistory: number[];
}
