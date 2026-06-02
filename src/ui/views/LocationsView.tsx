import React from "react";
import { C, bigBtn, ctrlBtn, fmtMoney } from "../theme";
import { Panel } from "../components";
import { LOCATION_DEFS, type LocationType, type World } from "../../engine/types";

export function LocationsView({ world, rentLocation, upgradeLocation }: {
  world: World;
  rentLocation: (type: LocationType, tier: number) => void;
  upgradeLocation: (id: string, newTier: number) => void;
}) {
  const locs = world.player.locations;
  const totalMonthly = locs.reduce((a, l) => a + l.monthlyCost, 0);
  const offices = locs.filter((l) => l.type === "office");
  const warehouses = locs.filter((l) => l.type === "warehouse");
  const factories = locs.filter((l) => l.type === "factory_onshore" || l.type === "factory_offshore");
  const pmSlots = offices.reduce((a, o) => a + LOCATION_DEFS.office.tiers[o.tier].capacity, 0);
  const warehouseSlots = warehouses.reduce((a, w) => a + LOCATION_DEFS.warehouse.tiers[w.tier].capacity, 0);

  return (
    <div>
      <Panel title="Your Locations">
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 6 }}>
          Monthly overhead: <span style={{ color: C.amber, fontFamily: "ui-monospace" }}>{fmtMoney(totalMonthly)}/mo</span>
          &nbsp;· PM capacity: <span style={{ color: C.cyan }}>{pmSlots} teams</span>
          &nbsp;· Warehouse: <span style={{ color: C.cyan }}>{warehouseSlots} product lines</span>
        </div>
        {locs.length === 0 && <div style={{ color: C.faint }}>No locations yet.</div>}
        {locs.map((loc) => {
          const def = LOCATION_DEFS[loc.type];
          const tier = def.tiers[loc.tier];
          const canUpgrade = loc.tier < def.tiers.length - 1;
          const nextTier = canUpgrade ? def.tiers[loc.tier + 1] : null;
          const upgradeCost = nextTier ? nextTier.setupCost - def.tiers[loc.tier].setupCost : 0;
          return (
            <div key={loc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.grid}` }}>
              <div>
                <div style={{ color: C.ink, fontWeight: 600, fontSize: 13 }}>{tier.label}</div>
                <div style={{ color: C.dim, fontSize: 11 }}>{tier.desc} · {fmtMoney(loc.monthlyCost)}/mo</div>
              </div>
              {canUpgrade && (
                <button style={ctrlBtn} onClick={() => upgradeLocation(loc.id, loc.tier + 1)}>
                  Upgrade → {nextTier!.label} ({fmtMoney(upgradeCost)})
                </button>
              )}
            </div>
          );
        })}
      </Panel>

      <Panel title="Open New Location">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {(Object.keys(LOCATION_DEFS) as LocationType[]).map((type) => {
            const def = LOCATION_DEFS[type];
            const entry = def.tiers[0];
            const already = locs.filter((l) => l.type === type).length;
            return (
              <div key={type} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 4 }}>{def.label}</div>
                <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.5, marginBottom: 6 }}>{entry.desc}</div>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 8 }}>
                  {entry.setupCost > 0 ? `Setup: ${fmtMoney(entry.setupCost)} · ` : ""}{fmtMoney(entry.monthlyCost)}/mo
                  {already > 0 && <span style={{ color: C.cyan }}> · {already} active</span>}
                </div>
                <button style={{ ...bigBtn, width: "100%", fontSize: 12 }}
                  disabled={world.player.cash < entry.setupCost}
                  onClick={() => rentLocation(type, 0)}>
                  {entry.setupCost > 0 ? `Build (${fmtMoney(entry.setupCost)})` : `Rent (${fmtMoney(entry.monthlyCost)}/mo)`}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
