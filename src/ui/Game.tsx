import React, { useState } from "react";
import { C, ctrlBtn, bigBtn, fmtMoney, fmtPct } from "./theme";
import { Stat, Panel, Slider } from "./components";
import { Home, SetupWizard } from "./setup/Setup";
import { ProductCreator, ContractModal, DistributionModal } from "./setup/Modals";
import { MarketView } from "./views/MarketView";
import { FinancialsView } from "./views/FinancialsView";
import { OperationsView, IntelligenceView } from "./views/OpsIntel";
import { ProductsView } from "./views/ProductsView";
import { StrategyView } from "./views/StrategyView";
import { SegmentsView } from "./views/SegmentsView";
import { BrandView } from "./views/BrandView";
import { CustomersView } from "./views/CustomersView";
import { LocationsView } from "./views/LocationsView";
import { PersonnelView } from "./views/PersonnelView";
import { POSITIONINGS, MARKETING_AGENCIES } from "../engine/industries";
import { TICKS_PER_QUARTER, DAYS_PER_MONTH } from "../engine/types";
import { useGame } from "../state/useGame";

// ============================================================================
// New four-section tab structure: Management | Operations | Financials | Marketing
// Each top-tab has sub-tabs. Existing views are relocated; new features get placeholders.
// ============================================================================

interface SubTab { id: string; label: string; }
interface TopTab { id: string; label: string; icon: string; subs: SubTab[]; }

const STRUCTURE: TopTab[] = [
  { id: "mgmt", label: "Management", icon: "🏢", subs: [
    { id: "locations", label: "Locations" },
    { id: "personnel", label: "Personnel" },
    { id: "strategy", label: "Strategy" },
    { id: "vision", label: "Vision & Brands" },
  ]},
  { id: "ops", label: "Operations", icon: "⚙️", subs: [
    { id: "products", label: "Products" },
    { id: "inventory", label: "Inventory" },
    { id: "distribution", label: "Distribution" },
  ]},
  { id: "fin", label: "Financials", icon: "📊", subs: [
    { id: "overview", label: "Overview" },
    { id: "analysis", label: "Analysis" },
  ]},
  { id: "mkt", label: "Marketing", icon: "📣", subs: [
    { id: "customers", label: "Customers" },
    { id: "segments", label: "Segments" },
    { id: "internal", label: "Internal" },
    { id: "campaigns", label: "Campaigns" },
  ]},
];

export function Game() {
  const g = useGame();
  const [topTab, setTopTab] = useState("mgmt");
  const [subTabs, setSubTabs] = useState<Record<string, string>>({ mgmt: "locations", ops: "products", fin: "overview", mkt: "customers" });
  const [seenEvents, setSeenEvents] = useState(0);

  const setSub = (sub: string) => setSubTabs((s) => ({ ...s, [topTab]: sub }));
  const sub = subTabs[topTab] || STRUCTURE.find((t) => t.id === topTab)!.subs[0].id;

  if (g.phase === "home") return <Shell><Home onStart={() => g.setPhase("setup")} /></Shell>;
  if (g.phase === "setup") return <Shell><SetupWizard onLaunch={g.launch} /></Shell>;

  const w = g.world!;
  const hist = w.history;
  const last = hist.at(-1) ?? ({} as any);
  const prev = hist[Math.max(0, hist.length - TICKS_PER_QUARTER)] ?? ({} as any);
  const shareDelta = (last.share || 0) - (prev.share || 0);
  const newEvent = w.events.length > seenEvents ? w.events[w.events.length - 1] : null;
  const day = (w.tick % DAYS_PER_MONTH) + 1;
  const month = Math.floor(w.tick / DAYS_PER_MONTH) % 12 + 1;
  const year = Math.floor(w.tick / (TICKS_PER_QUARTER * 4)) + 1;
  const curTop = STRUCTURE.find((t) => t.id === topTab)!;

  return (
    <Shell>
      {/* ---- top bar ---- */}
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: C.panel }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.violet }}>◈ {w.company}</div>
        <div style={{ color: C.faint, fontSize: 13 }}>{w.cfg.label}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <button onClick={() => g.setPlaying(!g.playing)} style={{ ...ctrlBtn, fontSize: 14, padding: "6px 12px" }}>{g.playing ? "❚❚" : "▶"}</button>
          {[1, 2, 4].map((s) => <button key={s} onClick={() => g.setSpeed(s)} style={{ ...ctrlBtn, background: g.speed === s ? C.violet : C.panel, color: g.speed === s ? "#fff" : C.dim, minWidth: 36, fontWeight: 700, border: g.speed === s ? `1px solid ${C.violet}` : `1px solid ${C.line}` }}>{s}×</button>)}
          <div style={{ color: C.dim, fontSize: 13, fontFamily: "ui-monospace", marginLeft: 8, background: C.panel2, padding: "4px 10px", borderRadius: 8 }}>
            Y{year} M{month} D{day}
          </div>
        </div>
      </div>

      {/* ---- quick stats ---- */}
      <div style={{ display: "flex", gap: 12, padding: "14px 24px", flexWrap: "wrap" }}>
        <Stat label="Share" value={fmtPct(last.share || 0)} color={C.violet} delta={shareDelta} />
        <Stat label="Revenue/Q" value={fmtMoney(last.revenue || 0)} color={C.green} />
        <Stat label="Profit/Q" value={fmtMoney(w.live?.income.profit || 0)} color={(w.live?.income.profit || 0) >= 0 ? C.green : C.red} />
        <Stat label="Cash" value={fmtMoney(w.player.cash)} color={w.player.cash < 0 ? C.red : C.ink} />
      </div>

      {/* ---- event banner ---- */}
      {newEvent && (
        <div style={{ margin: "0 24px", background: "#fef3c7", border: `1px solid #f59e0b`, borderRadius: 10, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#92400e", fontSize: 13, fontWeight: 500 }}>{newEvent.text}</span>
          <button style={{ ...ctrlBtn, padding: "2px 8px", fontSize: 11 }} onClick={() => setSeenEvents(w.events.length)}>✕</button>
        </div>
      )}

      {/* ---- top tabs ---- */}
      <div style={{ display: "flex", padding: "16px 24px 0", gap: 4 }}>
        {STRUCTURE.map((t) => (
          <button key={t.id} onClick={() => setTopTab(t.id)} style={{
            background: topTab === t.id ? C.panel : "transparent",
            color: topTab === t.id ? C.violet : C.dim,
            border: topTab === t.id ? `1px solid ${C.line}` : "1px solid transparent",
            borderBottom: topTab === t.id ? `1px solid ${C.panel}` : `1px solid ${C.line}`,
            borderRadius: "10px 10px 0 0", padding: "10px 22px", fontSize: 14, fontWeight: topTab === t.id ? 700 : 500, cursor: "pointer", marginBottom: -1,
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ---- sub tabs ---- */}
      <div style={{ display: "flex", gap: 4, padding: "0 24px", borderTop: `1px solid ${C.line}`, background: C.panel }}>
        {curTop.subs.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            background: "transparent", color: sub === s.id ? C.violet : C.faint,
            border: "none", borderBottom: sub === s.id ? `2px solid ${C.violet}` : "2px solid transparent",
            padding: "12px 18px", fontSize: 13, fontWeight: sub === s.id ? 700 : 400, cursor: "pointer",
          }}>{s.label}</button>
        ))}
      </div>

      {/* ---- content ---- */}
      <div style={{ padding: "16px 20px 40px" }}>
        {/* ======== MANAGEMENT ======== */}
        {topTab === "mgmt" && sub === "locations" && <LocationsView world={w} rentLocation={g.rentLocation} upgradeLocation={g.upgradeLocation} />}
        {topTab === "mgmt" && sub === "personnel" && <PersonnelView world={w} hirePersonnel={g.hirePersonnel} firePersonnel={g.firePersonnel} setFinanceDept={g.setFinanceDept} setIntelDept={g.setIntelDept} />}
        {topTab === "mgmt" && sub === "strategy" && (
          <div>
            <StrategyView world={w} />
            <div style={{ marginTop: 16 }}><IntelligenceView world={w} commission={g.commission} /></div>
          </div>
        )}
        {topTab === "mgmt" && sub === "vision" && <BrandView world={w} setVision={g.setVision} />}

        {/* ======== OPERATIONS ======== */}
        {topTab === "ops" && sub === "products" && <ProductsView world={w} produce={g.produce} setProductPrice={g.setProductPrice} setProductQuality={g.setProductQuality} openDistribution={g.openDistribution} openCreator={() => g.setModal("creator")} />}
        {topTab === "ops" && sub === "inventory" && <InventoryPlaceholder world={w} />}
        {topTab === "ops" && sub === "distribution" && <DistributionPlaceholder world={w} openContract={() => g.setModal("contract")} removeContract={g.removeContract} assignPartner={g.assignPartner} />}

        {/* ======== FINANCIALS ======== */}
        {topTab === "fin" && sub === "overview" && <FinancialsView world={w} hist={hist} borrow={g.borrow} repay={g.repay} />}
        {topTab === "fin" && sub === "analysis" && <AnalysisPlaceholder world={w} />}

        {/* ======== MARKETING ======== */}
        {topTab === "mkt" && sub === "customers" && (
          <div>
            <MarketView world={w} hist={hist} selectCell={g.selectCell} />
            <div style={{ marginTop: 16 }}><CustomersView world={w} /></div>
          </div>
        )}
        {topTab === "mkt" && sub === "segments" && <SegmentsView world={w} saveSegment={g.saveSegment} deleteSegment={g.deleteSegment} updateSegment={g.updateSegment} setFocus={g.setFocus} />}
        {topTab === "mkt" && sub === "internal" && <InternalMarketingPlaceholder world={w} setMarketing={g.setMarketing} setBrandMarketing={g.setBrandMarketing} />}
        {topTab === "mkt" && sub === "campaigns" && <CampaignsView world={w} launchCampaign={g.launchCampaign} />}
      </div>

      {/* ---- modals ---- */}
      {g.modal === "creator" && <ProductCreator world={w} onCreate={g.createProduct} onClose={() => g.setModal(null)} />}
      {g.modal === "contract" && <ContractModal world={w} onSign={g.signContract} onClose={() => g.setModal(null)} />}
      {g.modal === "distribution" && <DistributionModal world={w} skuIndex={g.distSku} setPackaging={g.setPackaging} setProductPrice={g.setProductPrice} setLicense={g.setLicense} toggleChannel={g.toggleProductChannel} openContract={() => g.setModal("contract")} onClose={() => g.setModal(null)} />}
    </Shell>
  );
}

// ============================================================================
// Placeholder views for features being built. Each describes what will live here.
// ============================================================================

function LocationsPlaceholder() {
  return (
    <div>
      <Panel title="🏢 Locations">
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.7 }}>
          Your company's physical presence. Locations determine what you can do and how big your teams can be.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 16 }}>
          <LocationCard type="Office" desc="Houses your teams (strategy, finance, marketing, product management). Small = basic teams + 2 PM teams. Upgrade for more capacity." status="Required to operate" cost="$8k–$40k/mo" />
          <LocationCard type="Warehouse" desc="Stores finished goods. Small = 3 product lines. Large = up to 12. No warehouse = can't hold inventory." status="Required to store products" cost="$5k–$25k/mo" />
          <LocationCard type="Factory (Onshore)" desc="Own manufacturing. Higher quality output but expensive to build and run." status="Optional — outsourcing available" cost="$200k setup + $15k/mo" />
          <LocationCard type="Factory (Offshore)" desc="Own manufacturing abroad. Lower cost per unit but lower quality ceiling." status="Optional — outsourcing available" cost="$100k setup + $8k/mo" />
        </div>
        <div style={{ color: C.faint, fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
          Coming: rent or purchase locations, upgrade capacity, and manage your physical footprint. For now, your company operates from a default small office.
        </div>
      </Panel>
    </div>
  );
}

function LocationCard({ type, desc, status, cost }: { type: string; desc: string; status: string; cost: string }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 6 }}>{type}</div>
      <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>{desc}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: C.amber }}>{status}</span>
        <span style={{ color: C.faint }}>{cost}</span>
      </div>
    </div>
  );
}

function InventoryPlaceholder({ world }: { world: any }) {
  return (
    <Panel title="📦 Inventory">
      <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.7 }}>
        Inventory by warehouse location. Each warehouse has a capacity limit — exceed it and you need to expand or rent another.
      </div>
      {world.player.skus.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ color: C.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>Current stock (default warehouse)</div>
          {world.player.skus.map((s: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.grid}`, fontSize: 13 }}>
              <span style={{ color: C.ink }}>{s.name}</span>
              <span style={{ color: s.inventory < 100 ? C.red : C.dim, fontFamily: "ui-monospace" }}>{s.inventory < 1 ? "OUT" : Math.round(s.inventory).toLocaleString()} units</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ color: C.faint, fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
        Coming: warehouse locations with capacity, storage costs, and multi-location inventory management.
      </div>
    </Panel>
  );
}

function DistributionPlaceholder({ world, openContract, removeContract, assignPartner }: { world: any; openContract: () => void; removeContract: (i: number) => void; assignPartner: (si: number, partnerId: string, assign: boolean) => void }) {
  return (
    <div>
    <Panel title="🤝 Distribution Partners">
      <div style={{ color: C.dim, fontSize: 13, marginBottom: 12 }}>
        Sign retail partners, then assign products to them. A product only sells through partners it's assigned to.
      </div>
      {world.player.contracts.length === 0 ? (
        <div style={{ color: C.faint, fontSize: 13, marginBottom: 12 }}>No distribution contracts yet.</div>
      ) : (
        <>{world.player.contracts.map((c: any, i: number) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.grid}`, fontSize: 13, alignItems: "center" }}>
            <div>
              <span style={{ color: C.ink, fontWeight: 600 }}>{c.partnerName || c.type}</span>
              <span style={{ color: C.dim, fontSize: 11, marginLeft: 8 }}>{(c.marginCut * 100).toFixed(0)}% cut · {c.paymentDays ?? 60}d pay</span>
            </div>
            <button style={ctrlBtn} onClick={() => removeContract(i)}>✕</button>
          </div>
        ))}</>
      )}
      <button style={{ ...ctrlBtn, marginTop: 12, width: "100%" }} onClick={openContract}>+ Negotiate new contract</button>
    </Panel>

    {/* Per-product partner assignment */}
    {world.player.skus.filter((s: any) => s.status === "active" || s.status === "manufacturing").length > 0 && world.player.contracts.length > 0 && (
      <Panel title="Product → Partner Assignment">
        <div style={{ color: C.faint, fontSize: 12, marginBottom: 10 }}>Toggle which partners carry each product.</div>
        {world.player.skus.filter((s: any) => s.status === "active" || s.status === "manufacturing").map((sku: any, _: number) => {
          const si = world.player.skus.indexOf(sku);
          return (
            <div key={sku.id} style={{ marginBottom: 12 }}>
              <div style={{ color: C.ink, fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{sku.name}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {world.player.contracts.map((c: any) => {
                  const on = sku.assignedPartnerIds?.includes(c.partnerId);
                  return (
                    <button key={c.partnerId} onClick={() => assignPartner(si, c.partnerId, !on)} style={{
                      background: on ? C.cyan : C.panel2, color: on ? "#fff" : C.faint,
                      border: `1px solid ${on ? C.cyan : C.line}`, borderRadius: 5,
                      padding: "4px 8px", fontSize: 11, cursor: "pointer",
                    }}>{on ? "✓ " : ""}{c.partnerName}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Panel>
    )}
    </div>
  );
}

function AnalysisPlaceholder({ world }: { world: any }) {
  const live = world.live;
  return (
    <Panel title="📈 Analysis — by Brand & Product">
      {!live ? <div style={{ color: C.faint }}>No data yet.</div> : (
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ color: C.faint, textAlign: "right" }}><th style={{ textAlign: "left", padding: "6px 4px" }}>Product</th><th>Status</th><th>Inventory</th><th>Units Sold</th><th>Contribution</th></tr></thead>
            <tbody style={{ fontFamily: "ui-monospace" }}>
              {world.player.skus.map((s: any, i: number) => {
                return (
                  <tr key={i} style={{ borderTop: `1px solid ${C.grid}`, textAlign: "right" }}>
                    <td style={{ textAlign: "left", color: C.ink, padding: "8px 4px" }}>{s.name}</td>
                    <td style={{ color: s.status === "active" ? C.green : s.status === "designing" ? C.amber : C.dim, fontSize: 11 }}>{s.status}</td>
                    <td style={{ color: C.dim }}>{Math.round(s.inventory).toLocaleString()}</td>
                    <td style={{ color: C.ink }}>{Math.round(s.unitsSoldTotal).toLocaleString()}</td>
                    <td style={{ color: (s.contributionTotal ?? 0) >= 0 ? C.green : C.red }}>{fmtMoney(s.contributionTotal ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function InternalMarketingPlaceholder({ world, setMarketing, setBrandMarketing }: { world: any; setMarketing: (v: number) => void; setBrandMarketing: (v: number) => void }) {
  const hasTeam = world.player.personnel.some((p: any) => p.role === "marketing");
  const teamSize = world.player.personnel.filter((p: any) => p.role === "marketing").length;
  return (
    <Panel title="📢 Internal Marketing">
      {!hasTeam ? (
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.7 }}>
          You have no marketing team. Go to <strong style={{ color: C.cyan }}>Management → Personnel</strong> and hire a Marketing person to unlock marketing spend.
        </div>
      ) : (
        <div>
          <div style={{ color: C.dim, fontSize: 13, marginBottom: 12 }}>
            Marketing team: {teamSize} member{teamSize > 1 ? "s" : ""} — you can focus on up to {teamSize} target{teamSize > 1 ? "s" : ""} simultaneously.
          </div>
          <Slider label="Performance marketing (per Q)" min={0} max={400000} step={5000} value={world.player.marketingTarget} fmt={fmtMoney} onChange={setMarketing} />
          <Slider label="Brand marketing (per Q)" min={0} max={400000} step={5000} value={world.player.brandMarketingTarget} fmt={fmtMoney} onChange={setBrandMarketing} />
          <div style={{ color: C.dim, fontSize: 13, marginTop: 6 }}>
            Focus: <span style={{ color: C.cyan }}>{world.player.marketingFocus === "all" ? "All segments" : world.player.marketingFocus}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function CampaignsView({ world, launchCampaign }: { world: any; launchCampaign: (name: string, segmentId: string, agencyId: string, budget: number, days: number) => void }) {
  const [campSeg, setCampSeg] = React.useState("");
  const [campAgency, setCampAgency] = React.useState("");
  const [campBudget, setCampBudget] = React.useState(100000);
  const [campDays, setCampDays] = React.useState(30);
  const [campScope, setCampScope] = React.useState("company"); // company | product:<id>
  const segs = world.savedSegments;
  const agency = MARKETING_AGENCIES.find((a: any) => a.id === campAgency);
  const effectiveCost = agency ? campBudget * agency.baseCostMult : campBudget;
  const affordable = effectiveCost <= world.player.cash;
  const segName = segs.find((s: any) => s.id === campSeg)?.name;
  const scopeLabel = campScope === "company" ? world.company : world.player.skus.find((s: any) => s.id === campScope)?.name ?? world.brand.name;
  return (
    <div>
      {world.activeCampaigns?.length > 0 && (
        <Panel title="Active Campaigns">
          {world.activeCampaigns.map((c: any) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${C.grid}` }}>
              <span style={{ color: C.ink }}>{c.name}</span>
              <span style={{ color: C.cyan, fontFamily: "ui-monospace" }}>{c.daysRemaining}d left · {fmtMoney(c.budget)}</span>
            </div>
          ))}
        </Panel>
      )}

      <Panel title="Launch a Campaign">
        {segs.length === 0 ? (
          <div style={{ color: C.faint, fontSize: 13 }}>Create a saved segment first (Marketing → Segments) to target a campaign.</div>
        ) : (
          <div>
            <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>1. Choose agency</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 16 }}>
              {MARKETING_AGENCIES.map((a: any) => {
                const rel = world.agencyRelationships?.[a.id] ?? 0;
                const relLabel = rel === 0 ? "New" : rel < 3 ? "Developing" : rel < 6 ? "Trusted" : "Partner";
                return (
                  <button key={a.id} onClick={() => setCampAgency(a.id)}
                    style={{ textAlign: "left", background: campAgency === a.id ? C.panel2 : C.bg, border: `1px solid ${campAgency === a.id ? C.cyan : C.line}`, borderRadius: 10, padding: 14, cursor: "pointer" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{a.name}</div>
                    <div style={{ color: C.dim, fontSize: 11, marginTop: 3 }}>{a.specialization}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
                      <span style={{ color: C.amber }}>×{a.baseCostMult.toFixed(1)} cost</span>
                      <span style={{ color: C.green }}>×{a.effectivenessMult.toFixed(1)} effect</span>
                    </div>
                    <div style={{ color: C.violet, fontSize: 10, marginTop: 4 }}>Relationship: {relLabel} ({rel} campaigns)</div>
                  </button>
                );
              })}
            </div>

            <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>2. Campaign scope</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              <button onClick={() => setCampScope("company")} style={{
                background: campScope === "company" ? C.violet : C.panel2, color: campScope === "company" ? "#fff" : C.dim,
                border: `1px solid ${campScope === "company" ? C.violet : C.line}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>🏢 Company ({world.company})</button>
              <button onClick={() => setCampScope("brand")} style={{
                background: campScope === "brand" ? C.violet : C.panel2, color: campScope === "brand" ? "#fff" : C.dim,
                border: `1px solid ${campScope === "brand" ? C.violet : C.line}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer",
              }}>🏷 Brand ({world.brand.name})</button>
              {world.player.skus.filter((s: any) => s.status === "active").map((s: any) => (
                <button key={s.id} onClick={() => setCampScope(s.id)} style={{
                  background: campScope === s.id ? C.violet : C.panel2, color: campScope === s.id ? "#fff" : C.dim,
                  border: `1px solid ${campScope === s.id ? C.violet : C.line}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer",
                }}>📦 {s.name}</button>
              ))}
            </div>

            <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>3. Target segment</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              {segs.map((s: any) => (
                <button key={s.id} onClick={() => setCampSeg(s.id)}
                  style={{ background: campSeg === s.id ? C.cyan : C.panel2, color: campSeg === s.id ? "#fff" : C.dim, border: `1px solid ${campSeg === s.id ? C.cyan : C.line}`, borderRadius: 5, padding: "4px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {s.name}
                </button>
              ))}
            </div>

            <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>4. Budget & duration</div>
            <Slider label="Budget" min={20000} max={500000} step={10000} value={campBudget} fmt={fmtMoney} onChange={setCampBudget} />
            <Slider label="Duration (days)" min={7} max={90} step={1} value={campDays} fmt={(v: number) => `${v}d`} onChange={setCampDays} />
            {agency && (
              <div style={{ fontSize: 12, color: affordable ? C.dim : C.red, marginTop: 4 }}>
                Actual cost: {fmtMoney(effectiveCost)} (×{agency.baseCostMult} agency rate) · Daily: {fmtMoney(effectiveCost / campDays)}
              </div>
            )}

            <button style={{ ...bigBtn, width: "100%", marginTop: 12, opacity: campSeg && campAgency && affordable ? 1 : 0.5 }}
              disabled={!campSeg || !campAgency || !affordable}
              onClick={() => { launchCampaign(`${agency?.name ?? "?"} → ${scopeLabel} → ${segName ?? "all"}`, campSeg, campAgency, campBudget, campDays); }}>
              Launch campaign
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <style>{`input[type=range]{height:4px;accent-color:${C.violet};} ::selection{background:${C.violet};color:#fff;} *{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;box-sizing:border-box;} body{margin:0;} button:hover{filter:brightness(0.95);} button:active{transform:scale(0.98);}`}</style>
      {children}
    </div>
  );
}
