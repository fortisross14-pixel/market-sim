// ============================================================================
// Capacity — derives what the company can do from its locations and personnel.
// These are pure derivations (no mutation), used by both the UI (to show limits)
// and the action handlers (to gate creation/production).
// ============================================================================
import type { World, LocationType } from "./types";
import { LOCATION_DEFS } from "./types";

// How many PM teams the office(s) can hold
export function pmCapacity(w: World): number {
  return w.player.locations
    .filter((l) => l.type === "office")
    .reduce((a, l) => a + LOCATION_DEFS.office.tiers[l.tier].capacity, 0);
}

// How many product lines the warehouse(s) can hold
export function warehouseCapacity(w: World): number {
  return w.player.locations
    .filter((l) => l.type === "warehouse")
    .reduce((a, l) => a + LOCATION_DEFS.warehouse.tiers[l.tier].capacity, 0);
}

// Monthly factory production capacity (units/month) — onshore + offshore combined
export function factoryCapacity(w: World): { onshore: number; offshore: number; total: number } {
  let onshore = 0, offshore = 0;
  for (const l of w.player.locations) {
    if (l.type === "factory_onshore") onshore += LOCATION_DEFS.factory_onshore.tiers[l.tier].capacity;
    if (l.type === "factory_offshore") offshore += LOCATION_DEFS.factory_offshore.tiers[l.tier].capacity;
  }
  return { onshore, offshore, total: onshore + offshore };
}

// How many products each PM is managing (each PM handles up to 2)
export function pmAssignments(w: World): { pmId: string; products: string[]; available: number }[] {
  const pms = w.player.personnel.filter((p) => p.role === "product_manager");
  // assign products round-robin to PMs
  return pms.map((pm, i) => {
    const assigned = w.player.skus.filter((_, si) => si % pms.length === i).map((s) => s.name);
    return { pmId: pm.id, products: assigned, available: Math.max(0, 2 - assigned.length) };
  });
}

// Can the player create a new product? Returns { ok, reason }
export function canCreateProduct(w: World): { ok: boolean; reason: string } {
  const whCap = warehouseCapacity(w);
  if (w.player.skus.length >= whCap) return { ok: false, reason: `Warehouse full (${w.player.skus.length}/${whCap} product lines). Upgrade or add a warehouse.` };
  const pms = w.player.personnel.filter((p) => p.role === "product_manager");
  if (pms.length === 0) return { ok: false, reason: "You need at least one Product Manager to design a product. Hire one in Management → Personnel." };
  // check for available PMs (not locked to a designing product)
  const lockedPmIds = new Set(w.player.skus.filter((s) => s.status === "designing" && s.assignedPmId).map((s) => s.assignedPmId));
  const availablePms = pms.filter((p) => !lockedPmIds.has(p.id));
  if (availablePms.length === 0) return { ok: false, reason: "All PMs are currently designing products. Wait for a design to finish or hire another PM." };
  return { ok: true, reason: "" };
}

// Can the player produce a batch? Returns { ok, reason, method }
export function canProduce(w: World, qty: number, unitCost: number): { ok: boolean; reason: string } {
  const cost = qty * unitCost;
  if (w.player.cash < cost) return { ok: false, reason: `Not enough cash (need ${Math.round(cost).toLocaleString()}, have ${Math.round(w.player.cash).toLocaleString()}).` };
  // if no factory, outsourcing is always available (at higher cost, which is already in unitCost)
  return { ok: true, reason: "" };
}
