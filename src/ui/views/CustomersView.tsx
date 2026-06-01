import React from "react";
import { C, fmtMoney, fmtNum, fmtPct } from "../theme";
import { Panel } from "../components";
import { customerTotals, getCustomers, cellLTV } from "../../engine/customers";
import { segmentStats } from "../../engine/segments";
import { TICKS_PER_QUARTER } from "../../engine/types";
import type { World } from "../../engine/types";

export function CustomersView({ world }: { world: World }) {
  const totals = customerTotals(world);
  const hasBase = totals.total > 0;

  // per saved-segment rollup of the customer base
  const segRows = world.savedSegments.map((seg) => {
    const idxs: number[] = [];
    world.cube.forEach((c, i) => {
      const ok = Object.entries(seg.filter).every(([ax, vals]) => !vals || vals.length === 0 || vals.includes((c.coord as any)[ax]));
      if (ok) idxs.push(i);
    });
    let count = 0, satW = 0, pop = 0, ltvW = 0;
    for (const i of idxs) {
      const cc = getCustomers(world, i);
      count += cc.count; satW += cc.satisfaction * cc.count; pop += world.cube[i].head;
      ltvW += cellLTV(world, i, world.cube[i].spend) * cc.count;
    }
    const sat = count > 0 ? satW / count : 0;
    const churnAnnual = Math.min(0.95, (0.015 + (0.72 - sat) * 0.14) * TICKS_PER_QUARTER * 4);
    return { name: seg.name, count, sat, penetration: pop > 0 ? count / pop : 0, ltv: count > 0 ? ltvW / count : 0, churn: count > 0 ? churnAnnual : 0 };
  });

  const satColor = (s: number) => s > 0.62 ? C.green : s > 0.48 ? C.amber : C.red;

  return (
    <div>
      <Panel title="Customer Base">
        {!hasBase ? <div style={{ color: C.faint, fontSize: 13 }}>No customers yet. Launch a product and build awareness to start acquiring a base.</div> : (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <BigStat label="Total customers" value={fmtNum(totals.total)} color={C.cyan} />
            <BigStat label="Avg satisfaction" value={fmtPct(totals.avgSatisfaction)} color={satColor(totals.avgSatisfaction)} />
            <BigStat label="Segments served" value={String(totals.activeCells)} color={C.ink} />
          </div>
        )}
        <div style={{ color: C.faint, fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
          Customers are a stock you build, retain, and can lose. Satisfied customers repurchase and recommend you (word-of-mouth grows the base); dissatisfied ones churn and dampen it. Neglect a segment — or let a rival serve it better — and the base erodes.
        </div>
      </Panel>

      <Panel title="By Segment">
        {!hasBase ? <div style={{ color: C.faint, fontSize: 13 }}>—</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: C.faint, textAlign: "right" }}>
                <th style={{ textAlign: "left" }}>Segment</th><th>Customers</th><th>Penetration</th><th>Satisfaction</th><th>Churn/yr</th><th>LTV</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: "ui-monospace" }}>
              {segRows.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.grid}`, textAlign: "right" }}>
                  <td style={{ textAlign: "left", color: C.ink, padding: "6px 0" }}>{r.name}</td>
                  <td style={{ color: C.ink }}>{r.count > 0 ? fmtNum(r.count) : "—"}</td>
                  <td style={{ color: C.dim }}>{r.count > 0 ? fmtPct(r.penetration) : "—"}</td>
                  <td style={{ color: r.count > 0 ? satColor(r.sat) : C.faint }}>{r.count > 0 ? fmtPct(r.sat) : "—"}</td>
                  <td style={{ color: C.dim }}>{r.count > 0 ? fmtPct(r.churn) : "—"}</td>
                  <td style={{ color: C.green }}>{r.count > 0 ? "$" + r.ltv.toFixed(0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ color: C.faint, fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
          LTV = a customer's expected lifetime value (annual spend × repeat rate ÷ churn). High-satisfaction segments churn slowly and are worth far more — protect them.
        </div>
      </Panel>
    </div>
  );
}

const BigStat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div>
    <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontSize: 28, fontWeight: 700, fontFamily: "ui-monospace" }}>{value}</div>
  </div>
);
