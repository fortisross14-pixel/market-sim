import React, { useState } from "react";
import { C, bigBtn, ctrlBtn, fmtMoney, fmtNum, fmtPct } from "../theme";
import { Panel, FieldLabel, TextInput, Slider } from "../components";
import { AXES, AXIS_KEYS } from "../../engine/industries";
import { segmentStats, type SegmentFilter } from "../../engine/segments";
import type { World, AxisKey } from "../../engine/types";

export function SegmentsView({ world, saveSegment, deleteSegment, updateSegment, setFocus }: {
  world: World;
  saveSegment: (name: string, filter: Record<string, string[]>) => void;
  deleteSegment: (id: string) => void;
  updateSegment: (id: string, name: string, filter: Record<string, string[]>) => void;
  setFocus: (v: string) => void;
}) {
  const [name, setName] = useState("");
  const [filter, setFilter] = useState<SegmentFilter>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const draftStats = segmentStats(world, filter);
  const mapRevealed = world.revealed.market_map;

  const toggle = (axis: AxisKey, val: string) => {
    setFilter((f) => {
      const cur = f[axis] ?? [];
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      return { ...f, [axis]: next };
    });
  };

  const startEdit = (seg: { id: string; name: string; filter: SegmentFilter }) => {
    setEditingId(seg.id); setName(seg.name); setFilter({ ...seg.filter });
  };
  const saveOrUpdate = () => {
    if (editingId) { updateSegment(editingId, name, filter); setEditingId(null); }
    else { saveSegment(name, filter); }
    setName(""); setFilter({});
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <Panel title="Build a Segment" style={{ flex: "1 1 380px" }}>
        <FieldLabel>Segment name</FieldLabel>
        <TextInput placeholder="e.g. Soccer Moms" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ height: 12 }} />
        <FieldLabel>Filters (leave an axis empty to include all)</FieldLabel>
        {AXIS_KEYS.map((axis) => (
          <div key={axis} style={{ marginBottom: 8 }}>
            <div style={{ color: C.faint, fontSize: 10, textTransform: "capitalize", marginBottom: 3 }}>{axis}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {AXES[axis].map((val) => {
                const on = (filter[axis] ?? []).includes(val);
                return (
                  <button key={val} onClick={() => toggle(axis, val)}
                    style={{ background: on ? C.cyan : C.panel2, color: on ? "#fff" : C.dim, border: `1px solid ${on ? C.cyan : C.line}`, borderRadius: 5, padding: "4px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 12, marginTop: 8 }}>
          <Stat2 k="Population" v={mapRevealed ? fmtNum(draftStats.population) + " people" : "—"} />
          <Stat2 k="Total market" v={mapRevealed ? fmtMoney(draftStats.market) : "—"} color={C.green} />
          <Stat2 k="Avg spend" v={mapRevealed ? "$" + draftStats.avgSpend.toFixed(0) : "—"} />
          <Stat2 k="Cells covered" v={`${draftStats.cellCount} of ${world.cube.length}`} />
        </div>
        <button style={{ ...bigBtn, width: "100%", marginTop: 12, opacity: name.trim() && draftStats.cellCount > 0 ? 1 : .5 }}
          disabled={!name.trim() || draftStats.cellCount === 0}
          onClick={saveOrUpdate}>
          {editingId ? "Save changes" : "Save segment"}
        </button>
        {editingId && <button style={{ ...ctrlBtn, width: "100%", marginTop: 6 }} onClick={() => { setEditingId(null); setName(""); setFilter({}); }}>Cancel edit</button>}
      </Panel>

      <Panel title="Saved Segments" style={{ flex: "1 1 380px" }}>
        {world.savedSegments.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No saved segments yet.</div>}
        {world.savedSegments.map((seg) => {
          const st = segmentStats(world, seg.filter);
          const targeted = world.player.marketingFocus === "seg:" + seg.id;
          const topNeed = Object.entries(st.needPref).sort((a, b) => b[1] - a[1])[0];
          return (
            <div key={seg.id} style={{ marginBottom: 12, padding: 12, background: C.panel2, border: `1px solid ${targeted ? C.cyan : C.line}`, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ color: C.ink, fontWeight: 600 }}>{seg.name}</span>
                <span style={{ color: C.dim, fontSize: 11, fontFamily: "ui-monospace" }}>{mapRevealed ? fmtMoney(st.market) : "—"}</span>
              </div>
              <div style={{ color: C.faint, fontSize: 11, margin: "3px 0 6px" }}>
                {mapRevealed ? `${fmtNum(st.population)} people · $${st.avgSpend.toFixed(0)} avg` : `${st.cellCount} cells`}
                {mapRevealed && topNeed && <> · wants <span style={{ color: C.violet }}>{world.cfg.needs.find((n) => n.key === topNeed[0])?.label}</span></>}
                {mapRevealed && st.playerShareValue > 0 && <> · you capture <span style={{ color: C.green }}>{fmtMoney(st.playerShareValue)}</span></>}
              </div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
                {Object.entries(seg.filter).filter(([, v]) => v && v.length > 0).map(([axis, vals]) => (
                  <span key={axis} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: "2px 6px", fontSize: 10, color: C.dim }}>{vals.join(", ")}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setFocus(targeted ? "all" : "seg:" + seg.id)}
                  style={{ ...ctrlBtn, background: targeted ? C.cyan : C.panel, color: targeted ? "#fff" : C.dim, flex: 1 }}>
                  {targeted ? "✓ Marketing focus" : "Target marketing here"}
                </button>
                <button style={ctrlBtn} onClick={() => startEdit(seg)}>Edit</button>
                <button style={ctrlBtn} onClick={() => deleteSegment(seg.id)}>✕</button>
              </div>
            </div>
          );
        })}
        <div style={{ color: C.faint, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
          Targeting a narrow segment concentrates marketing for stronger awareness per person; targeting a broad one spreads it thinner. Pick the trade-off.
        </div>
      </Panel>
    </div>
  );
}

const Stat2 = ({ k, v, color = C.ink }: { k: string; v: string; color?: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
    <span style={{ color: C.dim }}>{k}</span><span style={{ color, fontFamily: "ui-monospace", fontWeight: 600 }}>{v}</span>
  </div>
);
