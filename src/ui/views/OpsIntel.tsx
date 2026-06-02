import React from "react";
import { C, bigBtn, ctrlBtn, fmtMoney, fmtNum, fmtPct } from "../theme";
import { Panel, Slider, FieldLabel } from "../components";
import { AXES, CHANNEL_TYPES, PACKAGING } from "../../engine/industries";
import { contractReach } from "../../engine/economics";
import { STUDY_DEFS } from "../../engine/world";
import { TICKS_PER_QUARTER, DEPT_TIERS, type DeptTier } from "../../engine/types";
import type { World } from "../../engine/types";

export function OperationsView({ world, produce, openCreator, openContract, removeContract, setMarketing, setBackOffice, setFocus, openDistribution, setFinanceDept, setIntelDept }: {
  world: World; produce: (si: number, qty: number) => void; openCreator: () => void; openContract: () => void;
  removeContract: (i: number) => void; setMarketing: (v: number) => void; setBackOffice: (v: number) => void; setFocus: (v: string) => void;
  openDistribution: (si: number) => void;
  setFinanceDept: (t: DeptTier) => void; setIntelDept: (t: DeptTier) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <Panel title="Products" style={{ flex: "1 1 340px" }}>
        {world.player.skus.length === 0 && <div style={{ color: C.faint, marginBottom: 12 }}>No products yet.</div>}
        {world.player.skus.map((sku, si) => {
          const pkgLabel = PACKAGING.find((p) => p.key === sku.packaging)?.label ?? sku.packaging;
          const chCount = sku.channels.length;
          return (
            <div key={si} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.grid}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.violet, fontWeight: 600 }}>{sku.name}</span>
                <span style={{ color: sku.inventory < 1 ? C.red : C.dim, fontSize: 11, fontFamily: "ui-monospace" }}>stock {fmtNum(sku.inventory)}</span>
              </div>
              <div style={{ color: C.faint, fontSize: 11, margin: "2px 0 6px" }}>
                ${sku.listPrice} · q{sku.quality.toFixed(2)} · {pkgLabel} · {chCount === 0 ? <span style={{ color: C.red }}>not distributed</span> : `${chCount} channel${chCount > 1 ? "s" : ""}`}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...ctrlBtn, background: C.violet, color: "#fff", flex: 1 }} onClick={() => produce(si, 60000)}>+ Make 60k ({fmtMoney(60000 * sku.unitCost)})</button>
                <button style={{ ...ctrlBtn, flex: 1 }} onClick={() => openDistribution(si)}>Distribution / Sales</button>
              </div>
            </div>
          );
        })}
        <button style={{ ...bigBtn, background: C.violet, width: "100%", marginTop: 4 }} onClick={openCreator}>+ Launch a new product</button>
      </Panel>
      <Panel title="Distribution Contracts" style={{ flex: "1 1 300px" }}>
        {world.player.contracts.length === 0 && <div style={{ color: C.faint, marginBottom: 10, fontSize: 13 }}>No channels yet — you can't reach buyers. Negotiate a contract.</div>}
        {world.player.contracts.map((ct, i) => {
          const t = CHANNEL_TYPES[ct.type];
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.grid}` }}>
              <div>
                <div style={{ color: C.ink, fontSize: 13 }}>{t.label}</div>
                <div style={{ color: C.dim, fontSize: 11 }}>cut {(ct.marginCut * 100).toFixed(0)}% · reach {(contractReach(ct) * 100).toFixed(0)}% · pays {t.paymentDays}d · {fmtMoney(t.slotting)}/Q</div>
              </div>
              <button style={ctrlBtn} onClick={() => removeContract(i)}>end</button>
            </div>
          );
        })}
        <button style={{ ...bigBtn, background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, width: "100%", marginTop: 10 }} onClick={openContract}>+ Negotiate contract</button>
        <div style={{ height: 16 }} />
        <FieldLabel>Marketing focus</FieldLabel>
        {world.player.marketingFocus.startsWith("seg:") ? (
          <div style={{ background: C.panel2, border: `1px solid ${C.cyan}`, borderRadius: 7, padding: "6px 10px", marginBottom: 12, fontSize: 12, color: C.cyan, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Targeting: {world.savedSegments.find((s) => "seg:" + s.id === world.player.marketingFocus)?.name ?? "segment"}</span>
            <button style={ctrlBtn} onClick={() => setFocus("all")}>clear</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 3, background: C.panel2, borderRadius: 7, padding: 3, flexWrap: "wrap", marginBottom: 6 }}>
            {["all", ...AXES.age].map((o) => (
              <button key={o} onClick={() => setFocus(o)} style={{ background: world.player.marketingFocus === o ? C.cyan : "transparent", color: world.player.marketingFocus === o ? "#fff" : C.dim, border: "none", borderRadius: 5, padding: "4px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{o === "all" ? "All" : o}</button>
            ))}
          </div>
        )}
        {!world.player.marketingFocus.startsWith("seg:") && <div style={{ color: C.faint, fontSize: 11, marginBottom: 12 }}>Or target a saved segment in the Segments tab.</div>}
        <Slider label="Marketing / promotion (per Q)" min={20000} max={400000} step={5000} value={world.player.marketingTarget} fmt={fmtMoney} onChange={setMarketing} />
        <Slider label="Back-office overhead" min={40000} max={300000} step={5000} value={world.player.backOfficeTarget} fmt={fmtMoney} onChange={setBackOffice} />
      </Panel>

      <Panel title="Departments — what you know costs money" style={{ flex: "1 1 340px" }}>
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
          Bigger departments mean more visibility into your financials and market — but they cost every quarter.
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
    </div>
  );
}

export function IntelligenceView({ world, commission }: { world: World; commission: (t: string) => void }) {
  if (world.player.intelDept < 1) {
    return (
      <Panel title="Intelligence">
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
          You need at least a small Market Intelligence team to commission studies. Hire one in Operations → Departments.
        </div>
      </Panel>
    );
  }
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <Panel title="Commission a Study" style={{ flex: "1 1 320px" }}>
        {Object.entries(STUDY_DEFS).map(([type, def]) => {
          const inflight = world.studies.find((s) => s.type === type && !s.done);
          const done = world.revealed[type];
          return (
            <div key={type} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.grid}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.ink, fontWeight: 600 }}>{def.label}</span>
                <button onClick={() => commission(type)} disabled={!!inflight} style={{ background: inflight ? C.grid : C.cyan, color: inflight ? C.faint : "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: inflight ? "default" : "pointer" }}>{inflight ? `…${inflight.ticksLeft}t` : fmtMoney(def.cost)}</button>
              </div>
              <div style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>{def.blurb}</div>
              {done && <div style={{ color: C.faint, fontSize: 10, marginTop: 3 }}>last run: Q{Math.floor(done.asOfTick / TICKS_PER_QUARTER)}</div>}
            </div>
          );
        })}
      </Panel>
      <Panel title="Reports" style={{ flex: "1 1 360px" }}>
        {Object.keys(world.revealed).length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No reports yet.</div>}
        {world.revealed.market_map && <Report title="Population Map"><div style={{ fontSize: 13, color: C.dim }}>Cube sizes now visible in the Market tab. Total market: <span style={{ color: C.green }}>{fmtMoney(world.live?.totalMarket || 0)}</span>.</div></Report>}
        {world.revealed.gap_analysis && (
          <Report title="Gap Analysis — top underserved cells">
            {world.revealed.gap_analysis.gaps.map((g: any, i: number) => (
              <div key={i} style={{ fontSize: 12, padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.ink }}>{g.coord.age} · {g.coord.class} · {g.coord.gender} · {g.coord.leaning}</span>
                <span style={{ fontFamily: "ui-monospace", color: C.amber }}>{fmtMoney(g.market)} · fit {g.bestFit.toFixed(2)}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, color: C.faint, fontSize: 11 }}>High market + low best-fit = a niche nobody serves well.</div>
          </Report>
        )}
        {world.revealed.competitor_benchmark && (
          <Report title="Competitor Benchmark">
            <div style={{ fontFamily: "ui-monospace", fontSize: 12 }}>
              {world.revealed.competitor_benchmark.rivals.map((r: any, i: number) => <div key={i}>{r.name} <span style={{ color: C.violet }}>[{r.personality}]</span>: ${r.price} · ~{(r.margin * 100).toFixed(0)}% margin</div>)}
              <div style={{ borderTop: `1px solid ${C.grid}`, margin: "6px 0" }} />
              {world.revealed.competitor_benchmark.you.map((r: any, i: number) => <div key={i} style={{ color: C.cyan }}>{r.name}: ${r.price} · cost ${r.unitCost} · {(r.margin * 100).toFixed(0)}%</div>)}
            </div>
          </Report>
        )}
        {world.revealed.product_diagnosis && (
          <Report title="Product Diagnosis">
            {world.revealed.product_diagnosis.diagnoses.length === 0
              ? <div style={{ color: C.faint, fontSize: 13 }}>No products to diagnose.</div>
              : world.revealed.product_diagnosis.diagnoses.map((d: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5, padding: "6px 0", borderBottom: i < world.revealed.product_diagnosis.diagnoses.length - 1 ? `1px solid ${C.grid}` : "none" }}>
                  <span style={{ color: d.verdict === "mismatch" ? C.amber : d.verdict === "weak" ? C.red : C.green }}>
                    {d.verdict === "mismatch" ? "⚠ " : d.verdict === "weak" ? "✕ " : "✓ "}
                  </span>
                  <span style={{ color: C.ink }}>{d.message}</span>
                </div>
              ))}
            <div style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>Re-run after changing packaging or channels to see if the gap closed.</div>
          </Report>
        )}
        {world.revealed.market_report && (
          <Report title="Market Report">
            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, marginBottom: 8 }}>
              {world.revealed.market_report.summary}
            </div>
            <div style={{ fontSize: 12 }}>
              <div style={{ color: C.dim, marginBottom: 4 }}>Top 3 players:</div>
              {world.revealed.market_report.top3.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                  <span style={{ color: C.ink }}>{i + 1}. {p.name}</span>
                  <span style={{ fontFamily: "ui-monospace", color: C.violet }}>{fmtPct(p.share)}</span>
                </div>
              ))}
            </div>
            <div style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>
              Direction: <span style={{ color: world.revealed.market_report.direction === "growing" ? C.green : world.revealed.market_report.direction === "declining" ? C.red : C.dim }}>
                {world.revealed.market_report.direction}
              </span> ({fmtPct(world.revealed.market_report.marketGrowth)} vs base). {world.revealed.market_report.cover60} player(s) cover 60% of the market.
            </div>
          </Report>
        )}
      </Panel>
    </div>
  );
}
const Report = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 14, background: C.panel2, borderRadius: 8, padding: 12, border: `1px solid ${C.line}` }}>
    <div style={{ color: C.cyan, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>{title}</div>{children}
  </div>
);

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
