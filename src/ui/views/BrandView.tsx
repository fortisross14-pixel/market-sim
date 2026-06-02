import React, { useState } from "react";
import { C, fmtMoney, bigBtn, ctrlBtn } from "../theme";
import { Panel, Slider, FieldLabel } from "../components";
import { brandAverageEquity, earnedSignals, getEquity, type Equity } from "../../engine/brandEquity";
import { segmentStats } from "../../engine/segments";
import type { World, VisionGoal } from "../../engine/types";
import { VISION_GOALS, DESIGN_DEPTHS } from "../../engine/types";
import { INDUSTRIES } from "../../engine/industries";

const METRICS: { key: keyof Equity; label: string; color: string }[] = [
  { key: "trust", label: "Trust", color: "#34d399" },
  { key: "prestige", label: "Prestige", color: "#c084fc" },
  { key: "value", label: "Value", color: "#38bdf8" },
  { key: "innovation", label: "Innovation", color: "#fbbf24" },
];

export function BrandView({ world, setVision }: {
  world: World;
  setVision: (goal: VisionGoal, scope: string, audience: string, audienceLabel: string) => void;
}) {
  const avg = brandAverageEquity(world);
  const earned = earnedSignals(world);
  const hasProducts = world.player.skus.length > 0;

  // per-segment readout for saved segments: average equity over the segment's cells
  const segRows = world.savedSegments.map((seg) => {
    const idxs: number[] = [];
    world.cube.forEach((c, i) => {
      const ok = Object.entries(seg.filter).every(([ax, vals]) => !vals || vals.length === 0 || vals.includes((c.coord as any)[ax]));
      if (ok) idxs.push(i);
    });
    let tw = 0; const acc: Equity = { trust: 0, prestige: 0, value: 0, innovation: 0 };
    for (const i of idxs) {
      const h = world.cube[i].head; tw += h;
      const e = getEquity(world, i);
      acc.trust += e.trust * h; acc.prestige += e.prestige * h; acc.value += e.value * h; acc.innovation += e.innovation * h;
    }
    const eq: Equity = tw > 0 ? { trust: acc.trust / tw, prestige: acc.prestige / tw, value: acc.value / tw, innovation: acc.innovation / tw } : { trust: 0, prestige: 0, value: 0, innovation: 0 };
    return { name: seg.name, eq };
  });

  return (
    <div>
      <VisionPanel world={world} setVision={setVision} />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Panel title="Brand Equity (overall)" style={{ flex: "1 1 320px" }}>
          {!hasProducts ? <div style={{ color: C.faint, fontSize: 13 }}>Launch a product to start building a brand.</div> : (
            <>
              {METRICS.map((m) => (
                <div key={m.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                    <span style={{ color: C.ink }}>{m.label}</span>
                    <span style={{ color: C.dim, fontFamily: "ui-monospace", fontSize: 11 }}>
                      {(avg[m.key] * 100).toFixed(0)} <span style={{ color: C.faint }}>→ {(earned[m.key] * 100).toFixed(0)}</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: C.grid, borderRadius: 4, position: "relative", overflow: "hidden" }}>
                    <div style={{ width: `${avg[m.key] * 100}%`, height: "100%", background: m.color, borderRadius: 4 }} />
                    <div style={{ position: "absolute", top: 0, left: `${earned[m.key] * 100}%`, width: 2, height: "100%", background: C.ink, opacity: .5 }} />
                  </div>
                </div>
              ))}
              <div style={{ color: C.faint, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                Solid bar = current equity. The tick mark = where your pricing, quality, channels, and packaging are pulling it (your "earned" brand). Brand marketing closes the gap faster.
              </div>
            </>
          )}
        </Panel>

        <Panel title="Perception by Segment" style={{ flex: "1 1 360px" }}>
          {!hasProducts ? <div style={{ color: C.faint, fontSize: 13 }}>No brand yet.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: C.faint, textAlign: "right" }}>
                  <th style={{ textAlign: "left" }}>Segment</th>
                  {METRICS.map((m) => <th key={m.key} style={{ color: m.color }}>{m.label.slice(0, 4)}</th>)}
                </tr>
              </thead>
              <tbody style={{ fontFamily: "ui-monospace" }}>
                {segRows.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.grid}`, textAlign: "right" }}>
                    <td style={{ textAlign: "left", color: C.ink, padding: "5px 0" }}>{r.name}</td>
                    {METRICS.map((m) => <td key={m.key} style={{ color: C.dim }}>{(r.eq[m.key] * 100).toFixed(0)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ color: C.faint, fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
            The same brand reads differently to different people — prestige to the affluent may be irrelevance to budget buyers.
          </div>
        </Panel>
      </div>

      {/* Per-category equity breakdown */}
      {hasProducts && (
        <Panel title="Equity by Product Category — Hot Wheels ≠ Barbie">
          <div style={{ color: C.faint, fontSize: 11, marginBottom: 10 }}>Brand equity is per-category. Being strong in serums doesn't make you strong in cleansers.</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: C.faint, textAlign: "right" }}>
                <th style={{ textAlign: "left" }}>Category</th>
                {METRICS.map((m) => <th key={m.key} style={{ color: m.color }}>{m.label.slice(0, 4)}</th>)}
              </tr>
            </thead>
            <tbody style={{ fontFamily: "ui-monospace" }}>
              {Array.from(new Set(world.player.skus.map((s) => s.productKey))).map((pk) => {
                const catEq = brandAverageEquity(world, pk);
                const ptLabel = world.cfg.products.find((p) => p.key === pk)?.label ?? pk;
                return (
                  <tr key={pk} style={{ borderTop: `1px solid ${C.grid}`, textAlign: "right" }}>
                    <td style={{ textAlign: "left", color: C.ink, padding: "5px 0" }}>{ptLabel}</td>
                    {METRICS.map((m) => <td key={m.key} style={{ color: C.dim }}>{(catEq[m.key] * 100).toFixed(0)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function VisionPanel({ world, setVision }: { world: World; setVision: (goal: VisionGoal, scope: string, audience: string, audienceLabel: string) => void }) {
  const v = world.player.vision;
  const [goal, setGoal] = useState<VisionGoal>(v?.goal ?? "quality");
  const [scope, setScope] = useState(v?.scope ?? world.cfg.id);
  const [audience, setAudience] = useState(v?.audience ?? "anyone");

  const goalDef = VISION_GOALS[goal];
  const isIndustryScope = Object.keys(INDUSTRIES).includes(scope);
  const scopeLabel = (() => {
    for (const ind of Object.values(INDUSTRIES)) { if (ind.id === scope) return ind.label; for (const p of ind.products) { if (p.key === scope) return p.label; } }
    return scope;
  })();
  const audienceLabel = audience === "anyone"
    ? "everyone"
    : world.savedSegments.find((s) => s.id === audience)?.name ?? audience;
  const statement = `"We want to be the ${goalDef.adjective} ${scopeLabel} company for ${audienceLabel}."`;
  const bonusMax = isIndustryScope ? goalDef.bonusMaxIndustry : goalDef.bonusMaxProduct;

  const ramp = v ? (1 + v.quartersPassed) / 5 : 0;
  const vIsIndustry = v ? Object.keys(INDUSTRIES).includes(v.scope) : false;
  const currentBonusMax = v ? (vIsIndustry ? VISION_GOALS[v.goal].bonusMaxIndustry : VISION_GOALS[v.goal].bonusMaxProduct) : 0;
  const currentBonus = currentBonusMax * ramp;

  return (
    <Panel title="Company Vision">
      {v && (
        <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, fontStyle: "italic", marginBottom: 8 }}>
            {`"We want to be the ${VISION_GOALS[v.goal].adjective} ${v.scope === world.cfg.id ? world.cfg.label : world.cfg.products.find((p) => p.key === v.scope)?.label ?? v.scope} company for ${v.audienceLabel}."`}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
            <div>
              <span style={{ color: C.dim }}>Bonus: </span>
              <span style={{ color: C.green, fontWeight: 600 }}>+{(currentBonusMax * 100).toFixed(0)}% {VISION_GOALS[v.goal].desc}</span>
            </div>
            <div>
              <span style={{ color: C.dim }}>Ramp: </span>
              <span style={{ color: C.amber, fontWeight: 600 }}>{(ramp * 100).toFixed(0)}%</span>
              <span style={{ color: C.faint }}> ({v.quartersPassed}/4 quarters)</span>
            </div>
            <div>
              <span style={{ color: C.dim }}>Current effect: </span>
              <span style={{ color: C.cyan, fontWeight: 600 }}>+{(currentBonus * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div style={{ height: 6, background: C.grid, borderRadius: 3, marginTop: 10 }}>
            <div style={{ width: `${ramp * 100}%`, height: "100%", background: C.amber, borderRadius: 3, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      <div style={{ color: C.dim, fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
        Set your company vision. The bonus takes 1 year to reach full strength (20% per quarter). Changing the vision resets the ramp.
      </div>

      <div style={{ color: C.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>Target goal</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(Object.keys(VISION_GOALS) as VisionGoal[]).map((g) => {
          const gd = VISION_GOALS[g];
          return (
            <button key={g} onClick={() => setGoal(g)} style={{
              flex: 1, background: goal === g ? C.panel2 : C.bg,
              border: `1px solid ${goal === g ? C.cyan : C.line}`, borderRadius: 8,
              padding: "10px 8px", cursor: "pointer", textAlign: "left",
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: goal === g ? C.ink : C.dim }}>{gd.adjective}</div>
              <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>{gd.desc}</div>
            </button>
          );
        })}
      </div>

      <div style={{ color: C.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>Scope — industry (+10%) or specific product (+20%)</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14, maxHeight: 180, overflowY: "auto" }}>
        {Object.values(INDUSTRIES).map((ind: any) => (
          <React.Fragment key={ind.id}>
            <button onClick={() => setScope(ind.id)} style={{
              background: scope === ind.id ? C.cyan : C.panel2, color: scope === ind.id ? "#fff" : C.dim,
              border: `1px solid ${scope === ind.id ? C.cyan : C.line}`, borderRadius: 5, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{ind.label} <span style={{ fontSize: 9, opacity: .7 }}>+10%</span></button>
            {ind.products.map((pt: any) => (
              <button key={pt.key} onClick={() => setScope(pt.key)} style={{
                background: scope === pt.key ? C.cyan : C.bg, color: scope === pt.key ? "#fff" : C.faint,
                border: `1px solid ${scope === pt.key ? C.cyan : C.line}`, borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer",
              }}>{pt.label} <span style={{ fontSize: 9, opacity: .7 }}>+20%</span></button>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div style={{ color: C.faint, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>Target audience</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={() => setAudience("anyone")} style={{
          background: audience === "anyone" ? C.cyan : C.panel2, color: audience === "anyone" ? "#fff" : C.dim,
          border: `1px solid ${audience === "anyone" ? C.cyan : C.line}`, borderRadius: 5, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>Everyone</button>
        {world.savedSegments.map((seg) => (
          <button key={seg.id} onClick={() => setAudience(seg.id)} style={{
            background: audience === seg.id ? C.cyan : C.panel2, color: audience === seg.id ? "#fff" : C.dim,
            border: `1px solid ${audience === seg.id ? C.cyan : C.line}`, borderRadius: 5, padding: "5px 10px", fontSize: 12, cursor: "pointer",
          }}>{seg.name}</button>
        ))}
      </div>

      <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontStyle: "italic", color: C.ink, fontWeight: 600 }}>{statement}</div>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>Bonus: {goalDef.desc} · Full effect in 4 quarters</div>
      </div>

      <button style={{ ...bigBtn, width: "100%", background: C.cyan, color: "#fff" }}
        onClick={() => setVision(goal, scope, audience, audienceLabel)}>
        {v ? "Change vision (resets ramp)" : "Set company vision"}
      </button>
    </Panel>
  );
}
