import React from "react";
import { C, fmtMoney, fmtNum, fmtPct } from "../theme";
import { Panel, LineChart, Row } from "../components";
import type { World, CellFinance, DeptTier } from "../../engine/types";

export function FinancialsView({ world, hist, borrow, repay }:
  { world: World; hist: World["history"]; borrow: (a: number) => void; repay: (a: number) => void }) {
  const tier = world.player.financeDept;
  const live = world.live;

  if (tier === 0) {
    return (
      <Panel>
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
          You have no Finance department. You can see your <strong style={{ color: C.ink }}>cash balance: {fmtMoney(world.player.cash)}</strong> and quarterly totals will appear at quarter-end.
        </div>
        <div style={{ color: C.faint, fontSize: 12, marginTop: 10 }}>
          Go to Operations → Departments to hire a Finance team and unlock detailed financial visibility.
        </div>
      </Panel>
    );
  }

  if (!live) return <Panel><div style={{ color: C.faint }}>No data yet.</div></Panel>;
  const I = live.income, F = live.cashflow;
  const markers = world.events.map((e) => ({ i: hist.findIndex((h) => h.tick >= e.tick) })).filter((m) => m.i >= 0);

  const cashNegative = F.cash < 0;
  const profitCashGap = Math.abs(I.profit - F.operatingCashFlow);

  return (
    <div>
      {/* Tier 1+: Sales by SKU */}
      <Panel title="Sales by SKU">
        {world.player.skus.length === 0 ? <div style={{ color: C.faint }}>No products yet.</div> :
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ color: C.dim, textAlign: "right" }}><th style={{ textAlign: "left", padding: "6px 4px" }}>SKU</th><th>List</th><th>Cost</th><th>Inventory</th><th>Units/Q</th><th>Net Rev</th><th>Margin</th></tr></thead>
            <tbody style={{ fontFamily: "ui-monospace" }}>
              {world.player.skus.map((s, i) => {
                const r = live.skuResults[i] || ({} as any);
                const out = (r.inventory ?? s.inventory) < 1;
                return (
                  <tr key={i} style={{ borderTop: `1px solid ${C.grid}`, textAlign: "right" }}>
                    <td style={{ textAlign: "left", color: C.ink, padding: "8px 4px" }}>{s.name}</td>
                    <td style={{ color: C.dim }}>${s.listPrice}</td>
                    <td style={{ color: C.dim }}>${s.unitCost.toFixed(1)}</td>
                    <td style={{ color: out ? C.red : C.ink }}>{out ? "OUT" : fmtNum(r.inventory ?? s.inventory)}</td>
                    <td style={{ color: C.ink }}>{fmtNum(r.units || 0)}</td>
                    <td style={{ color: C.ink }}>{fmtMoney(r.revenue || 0)}</td>
                    <td style={{ color: (r.margin || 0) >= 0 ? C.green : C.red }}>{fmtMoney(r.margin || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
        {world.player.lostSales > 1 && <div style={{ marginTop: 10, color: C.amber, fontSize: 12 }}>⚠ Lost sales from stock-outs: {fmtNum(world.player.lostSales)} units cumulative.</div>}
      </Panel>

      {/* Tier 3+: Charts */}
      {tier >= 3 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <Panel title="Profit vs. Operating Cash Flow" style={{ flex: "1 1 320px" }}>
            <LineChart series={[
              { data: hist.map((h) => h.profit), color: C.green },
              { data: hist.map((h) => h.operatingCashFlow), color: C.cyan },
            ]} fmt={fmtMoney} zeroLine markers={markers} />
            <div style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>
              <span style={{ color: C.green }}>● profit</span> &nbsp; <span style={{ color: C.cyan }}>● cash flow</span> — when they diverge, working capital is the cause.
            </div>
          </Panel>
          <Panel title="Cash Balance" style={{ flex: "1 1 320px" }}>
            <LineChart series={[{ data: hist.map((h) => h.cash), color: cashNegative ? C.red : C.amber }]} fmt={fmtMoney} zeroLine markers={markers} />
            {cashNegative && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>⚠ Cash is negative. Draw a credit line below or you'll be insolvent.</div>}
          </Panel>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Panel title="Income Statement (per quarter)" style={{ flex: "1 1 320px" }}>
          <Row k="Gross revenue" v={fmtMoney(I.grossRevenue)} />
          <Row k="− Channel cut" v={fmtMoney(-I.channelCut)} indent />
          <Row k="Net revenue" v={fmtMoney(I.netRevenue)} strong />
          <Row k="− COGS" v={fmtMoney(-I.cogs)} indent />
          <Row k="Contribution" v={fmtMoney(I.contribution)} strong />
          <Row k="− Marketing" v={fmtMoney(-I.marketing)} indent />
          <Row k="− Brand marketing" v={fmtMoney(-I.brandMarketing)} indent />
          <Row k="− Slotting fees" v={fmtMoney(-I.slotting)} indent />
          <Row k="− Back office" v={fmtMoney(-I.backOffice)} indent />
          <Row k="− Departments" v={fmtMoney(-I.deptOverhead)} indent />
          {I.licensingCost > 0 && <Row k="− Licensing" v={fmtMoney(-I.licensingCost)} indent />}
          <Row k="EBITDA" v={fmtMoney(I.ebitda)} strong />
          <Row k="− Interest" v={fmtMoney(-I.interest)} indent />
          <Row k="Net profit" v={fmtMoney(I.profit)} strong />
        </Panel>

        {/* Tier 2+: Cash Flow & Working Capital */}
        {tier >= 2 && (
          <Panel title="Cash Flow & Working Capital" style={{ flex: "1 1 320px" }}>
            <Row k="Cash on hand" v={fmtMoney(F.cash)} strong />
            <Row k="Inventory (cash tied up)" v={fmtMoney(F.inventoryValue)} />
            <Row k="Receivables (owed to you)" v={fmtMoney(F.receivables)} />
            <Row k="Debt" v={fmtMoney(F.debt)} />
            <Row k="Cash conversion cycle" v={`${Math.round(F.cashCycleDays)} days`} />
            <Row k="Operating cash flow / Q" v={fmtMoney(F.operatingCashFlow)} strong />
            <div style={{ marginTop: 10, color: C.faint, fontSize: 11, lineHeight: 1.5 }}>
              Profit and cash differ by {fmtMoney(profitCashGap)}/Q. Inventory and slow channel payments lock up cash even when you're profitable.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => borrow(1_000_000)} style={{ background: C.panel2, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>+ Draw $1M credit</button>
              <button onClick={() => repay(1_000_000)} style={{ background: C.panel2, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Repay $1M</button>
            </div>
            <div style={{ color: C.faint, fontSize: 10, marginTop: 4 }}>Credit line costs 10%/yr interest.</div>
          </Panel>
        )}
      </div>

      {/* Tier 2+: Contribution by Cell */}
      {tier >= 2 && (
        <Panel title="Contribution by Customer Cell — not all customers are equally valuable">
          <CellContributionTable cells={live.cellFinance} brandColor={world.brand.color} />
        </Panel>
      )}

      {tier < 2 && (
        <Panel>
          <div style={{ color: C.faint, fontSize: 12 }}>
            Upgrade your Finance department (Operations → Departments) to see cash flow, working capital, and per-cell contribution.
          </div>
        </Panel>
      )}
    </div>
  );
}

function CellContributionTable({ cells, brandColor }: { cells: CellFinance[]; brandColor: string }) {
  if (!cells.length) return <div style={{ color: C.faint, fontSize: 13 }}>No sales yet — launch a product and build awareness.</div>;
  const top = [...cells].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const maxRev = Math.max(...top.map((c) => c.revenue));
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr style={{ color: C.dim, textAlign: "right" }}>
        <th style={{ textAlign: "left", padding: "4px" }}>Cell</th><th>Revenue</th><th>Gross margin</th><th>Marketing</th><th>Contribution</th><th>Margin %</th>
      </tr></thead>
      <tbody style={{ fontFamily: "ui-monospace" }}>
        {top.map((c, i) => {
          const marginPct = c.revenue > 0 ? c.contribution / c.revenue : 0;
          return (
            <tr key={i} style={{ borderTop: `1px solid ${C.grid}`, textAlign: "right" }}>
              <td style={{ textAlign: "left", color: C.ink, padding: "6px 4px" }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: brandColor, opacity: c.revenue / maxRev, marginRight: 6 }} />
                {c.coord.age} {c.coord.gender.slice(0, 1)} {c.coord.class} {c.coord.leaning.slice(0, 4)}
              </td>
              <td style={{ color: C.ink }}>{fmtMoney(c.revenue)}</td>
              <td style={{ color: C.dim }}>{fmtMoney(c.grossMargin)}</td>
              <td style={{ color: C.dim }}>{fmtMoney(c.marketingAllocated)}</td>
              <td style={{ color: c.contribution >= 0 ? C.green : C.red }}>{fmtMoney(c.contribution)}</td>
              <td style={{ color: marginPct >= 0.2 ? C.green : marginPct >= 0 ? C.amber : C.red }}>{fmtPct(marginPct)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
