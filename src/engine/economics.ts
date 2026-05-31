import type { ProductType, ProductMethod, Contract } from "./types";
import { METHODS, CHANNEL_TYPES, clamp } from "./industries";

export const deriveUnitCost = (pt: ProductType, method: ProductMethod, m: number, p: number) =>
  pt.baseCost * (1 + m * 1.6 + p * 0.9) * METHODS[method].mult;

export const deriveQuality = (m: number, p: number) => clamp(0.55 * m + 0.45 * p);

// Better terms (concede more margin than the floor) buy better placement => more reach.
export function contractReach(contract: Contract): number {
  const t = CHANNEL_TYPES[contract.type];
  const generosity = clamp((contract.marginCut - t.marginCut) / 0.25, -0.5, 1);
  return clamp(t.baseReach * (1 + 0.4 * generosity));
}
