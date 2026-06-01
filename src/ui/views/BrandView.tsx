import React from "react";
import { C, fmtMoney } from "../theme";
import { Panel, Slider, FieldLabel } from "../components";
import { brandAverageEquity, earnedSignals, getEquity, type Equity } from "../../engine/brandEquity";
import { segmentStats } from "../../engine/segments";
import type { World } from "../../engine/types";

const METRICS: { key: keyof Equity; label: string; color: string }[] = [
  { key: "trust", label: "Trust", color: "#34d399" },
  { key: "prestige", label: "Prestige", color: "#c084fc" },
  { key: "value", label: "Value", color: "#38bdf8" },
  { key: "innovation", label: "Innovation", color: "#fbbf24" },
];

export function BrandView({ world, setMarketing, setBrandMarketing }: {
  world: World;
  setMarketing: (v: number) => void;
  setBrandMarketing: (v: number) => void;
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
      <Panel title="Marketing Split">
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
          Performance marketing drives awareness and sales now. Brand marketing builds equity — it doesn't move this quarter's sales, but it compounds and gives every future product a head-start.
        </div>
        <Slider label="Performance marketing (per Q)" min={20000} max={400000} step={5000} value={world.player.marketingTarget} fmt={fmtMoney} onChange={setMarketing} />
        <Slider label="Brand marketing (per Q)" min={0} max={400000} step={5000} value={world.player.brandMarketingTarget} fmt={fmtMoney} onChange={setBrandMarketing} />
      </Panel>

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
    </div>
  );
}
