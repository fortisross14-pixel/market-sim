import React, { useState } from "react";
import { C, fmtMoney, fmtNum, fmtPct } from "../theme";
import { Panel, LineChart, Seg } from "../components";
import { AXES } from "../../engine/industries";
import type { World, Coord } from "../../engine/types";

export function MarketView({ world, hist, selectCell }:
  { world: World; hist: World["history"]; selectCell: (c: Coord) => void }) {
  const markers = world.events.map((e) => ({ i: hist.findIndex((h) => h.tick >= e.tick) })).filter((m) => m.i >= 0);
  return (
    <>
      <Panel title="Your Market Share" style={{ marginBottom: 16 }}>
        <LineChart series={[{ data: hist.map((h) => h.share), color: world.brand.color }]} fmt={fmtPct} markers={markers} />
        <div style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>Launches start near 0% and climb as awareness builds. Amber lines mark market shocks.</div>
      </Panel>
      <CubeInspector world={world} selectCell={selectCell} />
    </>
  );
}

function CubeInspector({ world, selectCell }: { world: World; selectCell: (c: Coord) => void }) {
  const mapRevealed = world.revealed.market_map;
  const [gender, setGender] = useState("Female");
  const [leaning, setLeaning] = useState("Progressive");
  const cellFor = (age: string, klass: string) =>
    world.cube.find((c) => c.coord.gender === gender && c.coord.age === age && c.coord.class === klass && c.coord.leaning === leaning)!;
  const maxMarket = Math.max(...world.cube.map((c) => c.head * c.spend));
  const sel = world.selectedCell;
  const info = world.selectedInfo;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <Panel title="Population Cube — click a cell" style={{ flex: "1 1 420px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Seg label="Gender" opts={AXES.gender} val={gender} set={setGender} />
          <Seg label="Leaning" opts={AXES.leaning} val={leaning} set={setLeaning} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `auto repeat(${AXES.class.length}, 1fr)`, gap: 4, fontSize: 11 }}>
          <div />{AXES.class.map((k) => <div key={k} style={{ color: C.dim, textAlign: "center", paddingBottom: 4 }}>{k}</div>)}
          {AXES.age.map((age) => (
            <React.Fragment key={age}>
              <div style={{ color: C.dim, display: "flex", alignItems: "center", paddingRight: 6 }}>{age}</div>
              {AXES.class.map((klass) => {
                const cell = cellFor(age, klass); const market = cell.head * cell.spend; const intensity = market / maxMarket;
                const isSel = sel && sel.gender === gender && sel.age === age && sel.class === klass && sel.leaning === leaning;
                return (
                  <button key={klass} onClick={() => selectCell({ gender, age, class: klass, leaning })}
                    style={{ background: `rgba(52,195,255,${0.08 + intensity * 0.5})`, border: `1px solid ${isSel ? C.cyan : C.line}`, borderRadius: 6, padding: "10px 6px", cursor: "pointer", color: C.ink }}>
                    {mapRevealed
                      ? <><div style={{ fontFamily: "ui-monospace", fontSize: 12 }}>{fmtMoney(market)}</div><div style={{ color: C.dim, fontSize: 9 }}>{fmtNum(cell.head)} ppl</div></>
                      : <div style={{ color: C.faint, fontSize: 16 }}>◌</div>}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        {!mapRevealed && <div style={{ marginTop: 10, color: C.faint, fontSize: 12 }}>Cells hidden — run a Population Map Scan in Intelligence to reveal sizes.</div>}
      </Panel>
      <Panel title="Cell Detail" style={{ flex: "1 1 280px" }}>
        {!sel ? <div style={{ color: C.faint, fontSize: 13 }}>Click a cell to inspect its size, spend, and who they currently buy.</div> :
          <div>
            <div style={{ color: C.cyan, fontWeight: 600, marginBottom: 8 }}>{sel.age} · {sel.gender} · {sel.class} · {sel.leaning}</div>
            {info && <>
              <Detail k="Headcount" v={fmtNum(info.head) + " people"} />
              <Detail k="Avg annual spend" v={"$" + info.spend.toFixed(0)} />
              <Detail k="Cell market" v={fmtMoney(info.market)} color={C.green} />
              <div style={{ margin: "12px 0 6px", color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6 }}>Who they buy</div>
              {info.breakdown.length === 0 ? <div style={{ color: C.faint, fontSize: 12 }}>Largely unserved — a potential niche.</div> :
                info.breakdown.map((b: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                    <span style={{ color: b.isComp ? C.dim : world.brand.color }}>{b.name}{b.isComp ? "" : " (you)"}</span>
                    <span style={{ fontFamily: "ui-monospace", color: C.ink }}>{fmtPct(b.share)}</span>
                  </div>
                ))}
              {info.breakdown.filter((b: any) => !b.isComp).length === 0 && info.breakdown.length > 0 &&
                <div style={{ marginTop: 8, color: C.amber, fontSize: 11 }}>You don't serve this cell. Big market + weak rival fit = your gap.</div>}
            </>}
          </div>}
      </Panel>
    </div>
  );
}
const Detail = ({ k, v, color = C.ink }: { k: string; v: string; color?: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
    <span style={{ color: C.dim }}>{k}</span><span style={{ color, fontFamily: "ui-monospace", fontWeight: 600 }}>{v}</span>
  </div>
);
