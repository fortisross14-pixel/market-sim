import React, { useState } from "react";
import { C, ctrlBtn, fmtMoney, fmtPct } from "./theme";
import { Stat } from "./components";
import { Home, SetupWizard } from "./setup/Setup";
import { ProductCreator, ContractModal } from "./setup/Modals";
import { MarketView } from "./views/MarketView";
import { FinancialsView } from "./views/FinancialsView";
import { OperationsView, IntelligenceView } from "./views/OpsIntel";
import { StrategyView } from "./views/StrategyView";
import { POSITIONINGS } from "../engine/industries";
import { TICKS_PER_QUARTER } from "../engine/types";
import { useGame } from "../state/useGame";

const TABS = [
  { id: "market", label: "Market" },
  { id: "financials", label: "Financials" },
  { id: "operations", label: "Operations" },
  { id: "strategy", label: "Strategy" },
  { id: "intel", label: "Intelligence" },
];

export function Game() {
  const g = useGame();
  const [tab, setTab] = useState("market");
  const [seenEvents, setSeenEvents] = useState(0);

  if (g.phase === "home") return <Shell><Home onStart={() => g.setPhase("setup")} /></Shell>;
  if (g.phase === "setup") return <Shell><SetupWizard onLaunch={g.launch} /></Shell>;

  const w = g.world!;
  const hist = w.history;
  const last = hist.at(-1) ?? ({} as any);
  const prev = hist[Math.max(0, hist.length - TICKS_PER_QUARTER)] ?? ({} as any);
  const shareDelta = (last.share || 0) - (prev.share || 0);
  const newEvent = w.events.length > seenEvents ? w.events[w.events.length - 1] : null;

  return (
    <Shell>
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", background: C.panel }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}><span style={{ color: w.brand.color }}>◈</span> {w.company} <span style={{ color: C.dim, fontWeight: 400 }}>/ {w.brand.name}</span></div>
        <div style={{ color: C.faint, fontSize: 12 }}>{w.cfg.label} · {POSITIONINGS.find((p) => p.key === w.brand.positioning)?.label}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <button onClick={() => g.setPlaying(!g.playing)} style={ctrlBtn}>{g.playing ? "❚❚ Pause" : "▶ Play"}</button>
          {[1, 2, 4].map((s) => <button key={s} onClick={() => g.setSpeed(s)} style={{ ...ctrlBtn, background: g.speed === s ? C.cyan : C.panel2, color: g.speed === s ? "#06121c" : C.dim }}>{s}×</button>)}
          <div style={{ color: C.faint, fontSize: 12, fontFamily: "ui-monospace", marginLeft: 8 }}>Y{Math.floor(w.tick / (TICKS_PER_QUARTER * 4))} Q{Math.floor(w.tick / TICKS_PER_QUARTER) % 4 + 1} · {fmtMoney(w.player.cash)}</div>
        </div>
      </div>

      {newEvent && (
        <div style={{ margin: "12px 20px 0", background: "#2a1d0a", border: `1px solid ${C.amber}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: C.amber, fontSize: 13 }}>{newEvent.text}</span>
          <button style={ctrlBtn} onClick={() => setSeenEvents(w.events.length)}>got it</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, padding: "16px 20px 0", flexWrap: "wrap" }}>
        <Stat label="Market Share" value={fmtPct(last.share || 0)} color={w.brand.color} delta={shareDelta} />
        <Stat label="Net Rev / Q" value={fmtMoney(last.revenue || 0)} color={C.green} />
        <Stat label="Profit / Q" value={fmtMoney(w.live?.income.profit || 0)} color={(w.live?.income.profit || 0) >= 0 ? C.green : C.red} />
        <Stat label="Cash" value={fmtMoney(w.player.cash)} color={w.player.cash < 0 ? C.red : C.cyan} />
        <Stat label="Cash Cycle" value={`${Math.round(w.live?.cashflow.cashCycleDays || 0)}d`} color={C.violet} />
      </div>

      <div style={{ display: "flex", gap: 4, padding: "16px 20px 0" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? C.panel : "transparent", color: tab === t.id ? C.ink : C.dim, border: `1px solid ${tab === t.id ? C.line : "transparent"}`, borderBottom: tab === t.id ? `1px solid ${C.panel}` : `1px solid ${C.line}`, borderRadius: "8px 8px 0 0", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>
      <div style={{ padding: "16px 20px 40px", borderTop: `1px solid ${C.line}` }}>
        {tab === "market" && <MarketView world={w} hist={hist} selectCell={g.selectCell} />}
        {tab === "financials" && <FinancialsView world={w} hist={hist} borrow={g.borrow} repay={g.repay} />}
        {tab === "operations" && <OperationsView world={w} produce={g.produce} openCreator={() => g.setModal("creator")} openContract={() => g.setModal("contract")} removeContract={g.removeContract} setMarketing={g.setMarketing} setBackOffice={g.setBackOffice} setFocus={g.setFocus} />}
        {tab === "strategy" && <StrategyView world={w} />}
        {tab === "intel" && <IntelligenceView world={w} commission={g.commission} />}
      </div>

      {g.modal === "creator" && <ProductCreator world={w} onCreate={g.createProduct} onClose={() => { if (w.player.skus.length > 0) g.setModal(null); }} />}
      {g.modal === "contract" && <ContractModal world={w} onSign={g.signContract} onClose={() => g.setModal(null)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink }}>
      <style>{`input[type=range]{height:4px;} ::selection{background:${C.cyan};color:#000;} *{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;box-sizing:border-box;} body{margin:0;}`}</style>
      {children}
    </div>
  );
}
