import React from "react";
import { C, bigBtn, ctrlBtn, fmtMoney } from "../theme";
import { Panel } from "../components";
import { RARITY_DEFS, BASE_SALARIES, LOCATION_DEFS, DEPT_TIERS, type PersonnelRole, type DeptTier, type World } from "../../engine/types";

const ROLES: { role: PersonnelRole; label: string; desc: string }[] = [
  { role: "product_manager", label: "Product Manager", desc: "Designs and owns products. Each PM can manage up to 2 product lines." },
  { role: "finance", label: "Finance", desc: "Improves financial visibility. Equivalent to upgrading Finance department tier." },
  { role: "marketing", label: "Marketing", desc: "Runs internal marketing campaigns and manages brand spend." },
  { role: "strategy", label: "Strategy", desc: "Produces strategic reports and market intelligence." },
  { role: "operations", label: "Operations", desc: "Manages supply chain, logistics, and production efficiency." },
];

export function PersonnelView({ world, hirePersonnel, firePersonnel, setFinanceDept, setIntelDept }: {
  world: World;
  hirePersonnel: (role: PersonnelRole) => void;
  firePersonnel: (id: string) => void;
  setFinanceDept: (t: DeptTier) => void;
  setIntelDept: (t: DeptTier) => void;
}) {
  const staff = world.player.personnel;
  const totalSalary = staff.reduce((a, p) => a + p.salary, 0);
  const pmCount = staff.filter((p) => p.role === "product_manager").length;
  const pmCap = world.player.locations.filter((l) => l.type === "office").reduce((a, o) => a + LOCATION_DEFS.office.tiers[o.tier].capacity, 0);
  const productCount = world.player.skus.length;
  const unassignedProducts = Math.max(0, productCount - pmCount * 2);

  return (
    <div>
      <Panel title="Your Team">
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 4 }}>
          {staff.length} staff · Monthly payroll: <span style={{ color: C.amber, fontFamily: "ui-monospace" }}>{fmtMoney(totalSalary)}/mo</span>
          &nbsp;· PM teams: <span style={{ color: C.cyan }}>{pmCount}/{pmCap}</span>
        </div>
        {unassignedProducts > 0 && (
          <div style={{ color: C.amber, fontSize: 12, marginBottom: 8 }}>
            ⚠ {unassignedProducts} product{unassignedProducts > 1 ? "s have" : " has"} no PM assigned — you can't iterate on {unassignedProducts > 1 ? "them" : "it"} without a product manager.
          </div>
        )}
        {staff.length === 0 && <div style={{ color: C.faint, fontSize: 13, marginBottom: 12 }}>No staff hired yet. You need at least a Product Manager to design products.</div>}
        {staff.map((p) => {
          const rd = RARITY_DEFS[p.rarity];
          return (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.grid}` }}>
              <div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: rd.color, fontSize: 11, marginLeft: 8, fontWeight: 600 }}>★ {rd.label}</span>
                </div>
                <div style={{ color: C.dim, fontSize: 11 }}>
                  {ROLES.find((r) => r.role === p.role)?.label} · Skill {(p.skill * 100).toFixed(0)} · {fmtMoney(p.salary)}/mo
                </div>
              </div>
              <button style={ctrlBtn} onClick={() => firePersonnel(p.id)}>Fire</button>
            </div>
          );
        })}
      </Panel>

      <Panel title="Hire Staff">
        <div style={{ color: C.faint, fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
          Higher expertise attracts better candidates. Rarity determines skill and salary — a Legendary PM produces far better products but costs 7× a Common one.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {ROLES.map((r) => {
            const count = staff.filter((p) => p.role === r.role).length;
            const atCap = r.role === "product_manager" && pmCount >= pmCap;
            return (
              <div key={r.role} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{r.label}</div>
                <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.4, marginTop: 4, marginBottom: 8 }}>{r.desc}</div>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 6 }}>
                  Base: {fmtMoney(BASE_SALARIES[r.role])}/mo · {count} hired
                  {atCap && <span style={{ color: C.red }}> · at capacity (upgrade office)</span>}
                </div>
                <button style={{ ...bigBtn, width: "100%", fontSize: 12, opacity: atCap ? 0.5 : 1 }}
                  disabled={atCap} onClick={() => hirePersonnel(r.role)}>
                  Hire (rarity = luck + expertise)
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Departments — visibility tiers">
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
          Department tiers gate what you can see in Financials and Market tabs. Higher tier = more detail + faster updates, but costs per quarter.
        </div>
        <DeptSelector label="Finance" tier={world.player.financeDept} onChange={setFinanceDept} />
        <div style={{ height: 10 }} />
        <DeptSelector label="Market Intelligence" tier={world.player.intelDept} onChange={setIntelDept} />
        {(world.player.financeDept > 0 || world.player.intelDept > 0) && (
          <div style={{ color: C.amber, fontSize: 12, marginTop: 10 }}>
            Dept overhead: {fmtMoney((DEPT_TIERS.find((d) => d.tier === world.player.financeDept)?.cost ?? 0) + (DEPT_TIERS.find((d) => d.tier === world.player.intelDept)?.cost ?? 0))}/Q
          </div>
        )}
      </Panel>

      <Panel title="Expertise">
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 10 }}>
          Built from cumulative sales. Higher expertise attracts better candidates and improves product launch quality.
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <ExpertiseBar label={`${world.cfg.label} (industry)`} stars={world.player.expertise.industry[world.cfg.id] ?? 0} />
          {world.cfg.products.map((pt) => (
            <ExpertiseBar key={pt.key} label={pt.label} stars={world.player.expertise.category[pt.key] ?? 0} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function DeptSelector({ label, tier, onChange }: { label: string; tier: DeptTier; onChange: (t: DeptTier) => void }) {
  return (
    <div>
      <div style={{ color: C.ink, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {DEPT_TIERS.map((d) => (
          <button key={d.tier} onClick={() => onChange(d.tier)}
            style={{ background: tier === d.tier ? C.cyan : C.panel2, color: tier === d.tier ? "#fff" : C.dim, border: `1px solid ${tier === d.tier ? C.cyan : C.line}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, cursor: "pointer", flex: "1 1 0" }}>
            <div style={{ fontWeight: 600 }}>{d.label}</div>
            {d.cost > 0 && <div style={{ fontSize: 10, opacity: 0.8 }}>{fmtMoney(d.cost)}/Q</div>}
          </button>
        ))}
      </div>
      <div style={{ color: C.faint, fontSize: 11, marginTop: 3 }}>{DEPT_TIERS.find((d) => d.tier === tier)?.detail}</div>
    </div>
  );
}

function ExpertiseBar({ label, stars }: { label: string; stars: number }) {
  return (
    <div style={{ flex: "1 1 160px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: C.ink }}>{label}</span>
        <span style={{ color: C.amber }}>{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>
      </div>
      <div style={{ height: 6, background: C.grid, borderRadius: 3 }}>
        <div style={{ width: `${stars * 20}%`, height: "100%", background: C.amber, borderRadius: 3 }} />
      </div>
    </div>
  );
}
