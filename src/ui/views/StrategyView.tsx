import React from "react";
import { C, fmtMoney, fmtPct } from "../theme";
import { Panel } from "../components";
import { computeSwot, computePorter, computeBcg, computeBoardMemo, computeProductAnalysis, type BcgClass } from "../../engine/strategy";
import type { World } from "../../engine/types";

export function StrategyView({ world }: { world: World }) {
  const swot = computeSwot(world);
  const forces = computePorter(world);
  const bcg = computeBcg(world);
  const memo = computeBoardMemo(world);

  return (
    <div>
      <Panel title="Board Memo — this quarter">
        <div style={{ color: C.ink, fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{memo.headline}</div>
        {memo.whatHappened.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>What happened</div>
            {memo.whatHappened.map((h, i) => <div key={i} style={{ color: C.ink, fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>• {h}</div>)}
          </div>
        )}
        <div>
          <div style={{ color: C.amber, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>Strategic issues — your call</div>
          {memo.issues.map((q, i) => (
            <div key={i} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.amber}`, borderRadius: 6, padding: "8px 12px", marginBottom: 6, color: C.ink, fontSize: 13, lineHeight: 1.5 }}>{q}</div>
          ))}
        </div>
        <div style={{ marginTop: 10, color: C.faint, fontSize: 11 }}>These frame the dilemma. The decision is yours — there's no “correct” button.</div>
      </Panel>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Panel title="SWOT" style={{ flex: "1 1 360px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <SwotBox title="Strengths" color={C.green} items={swot.strengths} />
            <SwotBox title="Weaknesses" color={C.red} items={swot.weaknesses} />
            <SwotBox title="Opportunities" color={C.cyan} items={swot.opportunities} />
            <SwotBox title="Threats" color={C.amber} items={swot.threats} />
          </div>
        </Panel>

        <Panel title="Porter's Five Forces — pressure on you" style={{ flex: "1 1 320px" }}>
          {forces.map((f, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                <span style={{ color: C.ink }}>{f.name}</span>
                <span style={{ color: pressureColor(f.pressure), fontFamily: "ui-monospace" }}>{pressureLabel(f.pressure)}</span>
              </div>
              <div style={{ height: 6, background: C.grid, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${f.pressure * 100}%`, height: "100%", background: pressureColor(f.pressure) }} />
              </div>
              <div style={{ color: C.dim, fontSize: 11, marginTop: 3 }}>{f.note}</div>
            </div>
          ))}
        </Panel>
      </div>

      <Panel title="Portfolio — BCG Matrix">
        {bcg.length === 0 ? <div style={{ color: C.faint, fontSize: 13 }}>No products yet.</div> : <BcgMatrix items={bcg} brandColor={world.brand.color} />}
      </Panel>

      <Panel title="Product Analysis — where each product fits">
        {world.player.skus.length === 0 ? <div style={{ color: C.faint, fontSize: 13 }}>No products yet.</div> :
          computeProductAnalysis(world).map((pa, i) => (
            <div key={i} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.grid}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ color: world.brand.color, fontWeight: 600 }}>{pa.sku}</span>
                <span style={{ color: C.dim, fontSize: 11 }}>serves: {pa.topNeeds.map((n) => `${n.label} ${(n.value * 100).toFixed(0)}`).join(" · ")}</span>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <FitList title="Best-fit segments" color={C.green} rows={pa.best} />
                <FitList title="Worst-fit segments" color={C.red} rows={pa.worst} />
              </div>
            </div>
          ))}
      </Panel>
    </div>
  );
}

function SwotBox({ title, color, items }: { title: string; color: string; items: { text: string; weight: number }[] }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderTop: `2px solid ${color}`, borderRadius: 8, padding: 12 }}>
      <div style={{ color, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 8, fontWeight: 700 }}>{title}</div>
      {items.length === 0 ? <div style={{ color: C.faint, fontSize: 12 }}>—</div> :
        items.map((it, i) => <div key={i} style={{ color: C.ink, fontSize: 12, lineHeight: 1.45, marginBottom: 6 }}>• {it.text}</div>)}
    </div>
  );
}

const pressureColor = (p: number) => p > 0.66 ? C.red : p > 0.4 ? C.amber : C.green;
const pressureLabel = (p: number) => p > 0.66 ? "High" : p > 0.4 ? "Moderate" : "Low";

function BcgMatrix({ items, brandColor }: { items: ReturnType<typeof computeBcg>; brandColor: string }) {
  const W = 420, H = 320, pad = 50;
  // x = relative share (log-ish, 0..2+ mapped), high share on LEFT per BCG convention
  const xOf = (rel: number) => pad + (1 - Math.min(1, rel / 3)) * (W - 2 * pad);
  const yOf = (growth: number) => {
    const g = Math.max(-0.02, Math.min(0.02, growth));
    return pad + (1 - (g + 0.02) / 0.04) * (H - 2 * pad);
  };
  const quadrantLabels: { x: number; y: number; label: BcgClass; color: string }[] = [
    { x: pad + 40, y: pad + 16, label: "Star", color: C.green },
    { x: W - pad - 50, y: pad + 16, label: "Question Mark", color: C.amber },
    { x: pad + 40, y: H - pad - 8, label: "Cash Cow", color: C.cyan },
    { x: W - pad - 50, y: H - pad - 8, label: "Dog", color: C.faint },
  ];
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 460 }}>
        <rect width={W} height={H} fill={C.panel2} rx="8" />
        <line x1={W / 2} y1={pad} x2={W / 2} y2={H - pad} stroke={C.line} />
        <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke={C.line} />
        {quadrantLabels.map((q, i) => <text key={i} x={q.x} y={q.y} fill={q.color} fontSize="11" fontWeight="700" textAnchor="middle">{q.label}</text>)}
        <text x={W / 2} y={H - 14} fill={C.dim} fontSize="10" textAnchor="middle">← higher relative share          lower share →</text>
        <text x={16} y={H / 2} fill={C.dim} fontSize="10" textAnchor="middle" transform={`rotate(-90 16 ${H / 2})`}>← shrinking   market growth   growing →</text>
        {items.map((it, i) => (
          <g key={i}>
            <circle cx={xOf(it.relShare)} cy={yOf(it.growth)} r={Math.max(6, Math.min(22, Math.sqrt(it.revenue) / 12))} fill={brandColor} opacity="0.5" stroke={brandColor} />
            <text x={xOf(it.relShare)} y={yOf(it.growth) - 14} fill={C.ink} fontSize="10" textAnchor="middle">{it.sku}</text>
          </g>
        ))}
      </svg>
      <div style={{ flex: "1 1 220px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ color: C.dim, textAlign: "right" }}><th style={{ textAlign: "left", padding: "4px" }}>Product</th><th>Class</th><th>Rev/Q</th></tr></thead>
          <tbody style={{ fontFamily: "ui-monospace" }}>
            {items.map((it, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.grid}`, textAlign: "right" }}>
                <td style={{ textAlign: "left", color: C.ink, padding: "6px 4px" }}>{it.sku}</td>
                <td style={{ color: classColor(it.klass) }}>{it.klass}</td>
                <td style={{ color: C.dim }}>{fmtMoney(it.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, color: C.faint, fontSize: 11, lineHeight: 1.5 }}>
          Bubble size ≈ revenue. Stars need investment, Cash Cows fund the rest, Question Marks are bets, Dogs are decisions.
        </div>
      </div>
    </div>
  );
}
const classColor = (k: BcgClass) => k === "Star" ? C.green : k === "Cash Cow" ? C.cyan : k === "Question Mark" ? C.amber : C.faint;

function FitList({ title, color, rows }: { title: string; color: string; rows: { coord: any; market: number; demoFit: number; needFit: number; combined: number }[] }) {
  return (
    <div style={{ flex: "1 1 240px" }}>
      <div style={{ color, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>{title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead><tr style={{ color: C.faint, textAlign: "right" }}><th style={{ textAlign: "left" }}>Segment</th><th>Demo</th><th>Need</th><th>Fit</th></tr></thead>
        <tbody style={{ fontFamily: "ui-monospace" }}>
          {rows.map((r, i) => (
            <tr key={i} style={{ textAlign: "right" }}>
              <td style={{ textAlign: "left", color: C.ink, padding: "2px 0" }}>{r.coord.age} {r.coord.class.slice(0, 3)} {r.coord.gender.slice(0, 1)}</td>
              <td style={{ color: C.dim }}>{(r.demoFit * 100).toFixed(0)}</td>
              <td style={{ color: C.dim }}>{(r.needFit * 100).toFixed(0)}</td>
              <td style={{ color }}>{(r.combined * 100).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
