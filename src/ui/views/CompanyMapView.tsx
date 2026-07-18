import React, { useEffect, useMemo, useRef, useState } from "react";
import type { World, OperatingRoom, OperatingRoomKind, OperatingTeamKind, Personnel } from "../../engine/types";
import { C, ctrlBtn, bigBtn, fmtMoney } from "../theme";

const MAP = 48;
const TW = 54;
const TH = 27;

type RoomKind = OperatingRoomKind;
type TeamKind = OperatingTeamKind;
type Room = OperatingRoom;

const ROOM_META: Record<RoomKind, { label: string; icon: string; size: [number, number]; cost: number; monthlyCost: number; capacity: number; floor: string; wall: string; description: string }> = {
  office: { label: "Office", icon: "🏢", size: [4, 4], cost: 25_000, monthlyCost: 6_000, capacity: 6, floor: "#dbeafe", wall: "#4f6b91", description: "Houses product, marketing, finance, sales, strategy or operations teams." },
  factory: { label: "Factory", icon: "🏭", size: [6, 5], cost: 200_000, monthlyCost: 18_000, capacity: 100_000, floor: "#e5e7eb", wall: "#555f6b", description: "Enables owned manufacturing and provides production capacity." },
  warehouse: { label: "Warehouse", icon: "📦", size: [5, 5], cost: 70_000, monthlyCost: 8_000, capacity: 50_000, floor: "#fef3c7", wall: "#8b6b2f", description: "Stores finished goods and reduces inventory bottlenecks." },
  outsourcing: { label: "Sourcing Office", icon: "🤝", size: [4, 3], cost: 40_000, monthlyCost: 7_000, capacity: 150_000, floor: "#ede9fe", wall: "#68509a", description: "Manages suppliers, contract manufacturers and distribution partners." },
};

const TEAM_LABEL: Record<TeamKind, string> = {
  unassigned: "Unassigned",
  product: "Product Management",
  marketing: "Marketing",
  finance: "Finance & FP&A",
  sales: "Sales & Distribution",
  operations: "Operations",
  strategy: "Corporate Strategy",
};



function iso(x: number, y: number, ox: number, oy: number, zoom: number) {
  return { x: (x - y) * (TW / 2) * zoom + ox, y: (x + y) * (TH / 2) * zoom + oy };
}

function screenToTile(sx: number, sy: number, ox: number, oy: number, zoom: number) {
  const x = (sx - ox) / zoom;
  const y = (sy - oy) / zoom;
  return {
    x: Math.floor((y / (TH / 2) + x / (TW / 2)) / 2),
    y: Math.floor((y / (TH / 2) - x / (TW / 2)) / 2),
  };
}

function overlaps(a: Pick<Room, "x" | "y" | "w" | "h">, b: Pick<Room, "x" | "y" | "w" | "h">) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function CompanyMapView({ world, openCreator, updateRooms }: { world: World; openCreator: () => void; updateRooms: (rooms: OperatingRoom[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rooms = world.player.operatingRooms;
  const setRooms = (next: Room[] | ((prev: Room[]) => Room[])) => updateRooms(typeof next === "function" ? next(rooms) : next);
  const [selectedId, setSelectedId] = useState<string | null>(rooms[0]?.id ?? null);
  const [tool, setTool] = useState<RoomKind | "select">("select");
  const [hover, setHover] = useState({ x: 0, y: 0 });
  const [camera, setCamera] = useState({ x: 480, y: 25, zoom: 0.72 });
  const [message, setMessage] = useState("Select a room or choose a build tool.");
  const drag = useRef<{ active: boolean; moved: boolean; x: number; y: number }>({ active: false, moved: false, x: 0, y: 0 });

  const selected = rooms.find((r) => r.id === selectedId) ?? null;
  const productRooms = rooms.filter((r) => r.kind === "office" && r.team === "product" && r.productKey);
  const hasFactory = rooms.some((r) => r.kind === "factory");
  const hasWarehouse = rooms.some((r) => r.kind === "warehouse");
  const hasSourcing = rooms.some((r) => r.kind === "outsourcing");
  const totalBuildCost = rooms.reduce((sum, r) => sum + r.buildCost, 0);
  const monthlyRoomCost = rooms.reduce((sum, r) => sum + r.monthlyCost, 0);
  const warehouseUnits = rooms.filter(r=>r.kind==="warehouse").reduce((a,r)=>a+r.capacity,0);
  const inventoryUnits = world.player.skus.reduce((a,s)=>a+s.inventory+s.mfgBatchSize,0);
  const factoryUnits = rooms.filter(r=>r.kind==="factory").reduce((a,r)=>a+r.capacity,0);
  const supplierUnits = rooms.filter(r=>r.kind==="outsourcing").reduce((a,r)=>a+r.capacity,0);

  const flow = useMemo(() => productRooms.map((r) => {
    const sku = world.player.skus.find((s) => s.id === r.skuId) ?? world.player.skus.find((s) => s.productKey === r.productKey);
    const productionReady = sku?.method === "own" ? hasFactory : hasSourcing;
    return {
      room: r,
      label: world.cfg.products.find((p) => p.key === r.productKey)?.label ?? "New Product",
      sku,
      productionReady,
      inventoryReady: hasWarehouse,
      routeReady: world.player.contracts.length > 0 || hasSourcing,
    };
  }), [productRooms, world, hasFactory, hasWarehouse, hasSourcing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ratio = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    const height = 570;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#e7e9ed";
    ctx.fillRect(0, 0, width, height);

    const drawDiamond = (x: number, y: number, fill: string, stroke: string, alpha = 1) => {
      const p = iso(x, y, camera.x, camera.y, camera.zoom);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + TW / 2 * camera.zoom, p.y + TH / 2 * camera.zoom);
      ctx.lineTo(p.x, p.y + TH * camera.zoom);
      ctx.lineTo(p.x - TW / 2 * camera.zoom, p.y + TH / 2 * camera.zoom);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    for (let y = 0; y < MAP; y++) {
      for (let x = 0; x < MAP; x++) drawDiamond(x, y, (x + y) % 2 ? "#f6f7f8" : "#f1f2f4", "#d8dadd");
    }

    const ordered = [...rooms].sort((a, b) => (a.x + a.y + a.w + a.h) - (b.x + b.y + b.w + b.h));
    for (const room of ordered) {
      const meta = ROOM_META[room.kind];
      for (let yy = room.y; yy < room.y + room.h; yy++) for (let xx = room.x; xx < room.x + room.w; xx++) drawDiamond(xx, yy, meta.floor, room.id === selectedId ? C.violet : "#c8cbd0");

      const heightWall = 34 * camera.zoom;
      const a = iso(room.x, room.y, camera.x, camera.y, camera.zoom);
      const b = iso(room.x + room.w, room.y, camera.x, camera.y, camera.zoom);
      const d = iso(room.x, room.y + room.h, camera.x, camera.y, camera.zoom);
      ctx.fillStyle = meta.wall;
      ctx.globalAlpha = room.id === selectedId ? 0.95 : 0.78;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - heightWall); ctx.lineTo(a.x, a.y - heightWall); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(d.x, d.y); ctx.lineTo(d.x, d.y - heightWall); ctx.lineTo(a.x, a.y - heightWall); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;

      const center = iso(room.x + room.w / 2, room.y + room.h / 2, camera.x, camera.y, camera.zoom);
      ctx.textAlign = "center";
      ctx.fillStyle = "#1f2937";
      ctx.font = `700 ${Math.max(10, 13 * camera.zoom)}px system-ui`;
      ctx.fillText(meta.icon + " " + room.name, center.x, center.y - heightWall - 6);
      ctx.font = `${Math.max(9, 11 * camera.zoom)}px system-ui`;
      ctx.fillStyle = "#4b5563";
      const sub = room.kind === "office" ? TEAM_LABEL[room.team] : meta.label;
      ctx.fillText(sub, center.x, center.y - heightWall + 10);
    }

    if (tool !== "select") {
      const [w, h] = ROOM_META[tool].size;
      const candidate = { x: hover.x, y: hover.y, w, h };
      const valid = hover.x >= 0 && hover.y >= 0 && hover.x + w <= MAP && hover.y + h <= MAP && !rooms.some((r) => overlaps(candidate, r));
      for (let yy = hover.y; yy < hover.y + h; yy++) for (let xx = hover.x; xx < hover.x + w; xx++) if (xx >= 0 && yy >= 0 && xx < MAP && yy < MAP) drawDiamond(xx, yy, valid ? "#bbf7d0" : "#fecaca", valid ? "#16a34a" : "#dc2626", 0.75);
    }
  }, [rooms, selectedId, hover, tool, camera]);

  const pickRoom = (tileX: number, tileY: number) => [...rooms].reverse().find((r) => tileX >= r.x && tileX < r.x + r.w && tileY >= r.y && tileY < r.y + r.h);

  const pointerTile = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return screenToTile(e.clientX - rect.left, e.clientY - rect.top, camera.x, camera.y, camera.zoom);
  };

  const place = (kind: RoomKind, x: number, y: number) => {
    const meta = ROOM_META[kind];
    const [w, h] = meta.size;
    const candidate = { x, y, w, h };
    if (x < 0 || y < 0 || x + w > MAP || y + h > MAP || rooms.some((r) => overlaps(candidate, r))) {
      setMessage("That room does not fit there.");
      return;
    }
    if (world.player.cash < meta.cost) { setMessage(`Not enough cash to build ${meta.label}.`); return; }
    const n = rooms.filter((r) => r.kind === kind).length + 1;
    const room: Room = { id: `${kind}-${Date.now()}`, kind, x, y, w, h, name: `${meta.label} ${n}`, team: kind === "office" ? "unassigned" : "operations", productKey: null, skuId: null, assignedPersonnelIds: [], buildCost: meta.cost, monthlyCost: meta.monthlyCost, capacity: meta.capacity };
    world.player.cash -= meta.cost;
    setRooms((rs) => [...rs, room]);
    setSelectedId(room.id);
    setTool("select");
    setMessage(`${meta.label} built. Assign its operating role in the contextual panel.`);
  };

  const updateSelected = (patch: Partial<Room>) => {
    if (!selectedId) return;
    setRooms((rs) => rs.map((r) => r.id === selectedId ? { ...r, ...patch } : r));
  };

  const blockers = [
    !productRooms.length && "No product management team has a category mandate.",
    !hasFactory && !hasSourcing && "No factory or sourcing office can manufacture products.",
    !hasWarehouse && "No warehouse exists; scaled inventory will be constrained.",
    !world.player.contracts.length && !hasSourcing && "No route to market or distribution-contract team exists.",
    !rooms.some((r) => r.kind === "office" && r.team === "finance") && "No finance team is monitoring unit economics and cash.",
  ].filter(Boolean) as string[];

  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 330px", gap: 14, alignItems: "start" }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button style={{ ...ctrlBtn, background: tool === "select" ? C.violet : C.panel, color: tool === "select" ? "white" : C.dim }} onClick={() => setTool("select")}>↖ Select</button>
        {(Object.keys(ROOM_META) as RoomKind[]).map((kind) => <button key={kind} style={{ ...ctrlBtn, background: tool === kind ? C.violet : C.panel, color: tool === kind ? "white" : C.dim }} onClick={() => { setTool(kind); setMessage(`Click the floor to place a ${ROOM_META[kind].label.toLowerCase()}.`); }}>{ROOM_META[kind].icon} {ROOM_META[kind].label} · {fmtMoney(ROOM_META[kind].cost)}</button>)}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button style={ctrlBtn} onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(.45, c.zoom - .08) }))}>−</button>
          <button style={ctrlBtn} onClick={() => setCamera({ x: 480, y: 25, zoom: .72 })}>Center</button>
          <button style={ctrlBtn} onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(1.15, c.zoom + .08) }))}>＋</button>
        </div>
      </div>

      <div ref={wrapRef} style={{ background: "#e7e9ed", border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", position: "relative" }}>
        <canvas ref={canvasRef}
          onPointerDown={(e) => { drag.current = { active: true, moved: false, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => {
            const t = pointerTile(e); setHover(t);
            if (!drag.current.active) return;
            const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
            if (tool === "select" && drag.current.moved) {
              setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
              drag.current.x = e.clientX; drag.current.y = e.clientY;
            }
          }}
          onPointerUp={(e) => {
            const t = pointerTile(e);
            if (!drag.current.moved) {
              if (tool === "select") {
                const r = pickRoom(t.x, t.y); setSelectedId(r?.id ?? null); setMessage(r ? `${r.name} selected.` : "Empty floor selected.");
              } else place(tool, t.x, t.y);
            }
            drag.current.active = false;
          }}
          style={{ display: "block", cursor: tool === "select" ? "grab" : "crosshair", touchAction: "none" }} />
        <div style={{ position: "absolute", left: 12, bottom: 10, background: "rgba(255,255,255,.9)", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, color: C.dim }}>48×48 floor · drag to pan · click to select/build</div>
      </div>

      <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: C.panel, border: `1px solid ${C.line}`, color: C.dim, fontSize: 12 }} aria-live="polite">{message}</div>

      <div style={{ marginTop: 14, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Operating model</div>
        {flow.length === 0 ? <div style={{ color: C.faint, fontSize: 13 }}>Assign an office to Product Management and give it a product category to begin the value chain.</div> : flow.map((f) => <div key={f.room.id} style={{ display: "grid", gridTemplateColumns: "1.2fr repeat(4, 1fr)", gap: 7, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${C.line}`, fontSize: 12 }}>
          <div><b>{f.label}</b><div style={{ color: C.faint }}>{f.sku ? f.sku.name : "Concept only"}</div></div>
          <FlowStep ok label="Product team" detail="Concept" />
          <FlowStep ok={f.productionReady} label="Make / buy" detail={f.sku?.method === "own" ? "Factory" : "Supplier"} />
          <FlowStep ok={f.inventoryReady} label="Inventory" detail="Warehouse" />
          <FlowStep ok={f.routeReady} label="Route to market" detail="Contracts" />
        </div>)}
      </div>
    </div>

    <aside style={{ display: "grid", gap: 12 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 15 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Context</div>
        {!selected ? <div style={{ color: C.faint, fontSize: 13 }}>Select a room on the map.</div> : <>
          <div style={{ color: C.dim, fontSize: 12, marginBottom: 12 }}>{ROOM_META[selected.kind].icon} {ROOM_META[selected.kind].description}</div>
          <label style={labelStyle}>Room name<input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} style={inputStyle} /></label>
          {selected.kind === "office" && <>
            <label style={labelStyle}>Assign team<select value={selected.team} onChange={(e) => updateSelected({ team: e.target.value as TeamKind, productKey: e.target.value === "product" ? selected.productKey : null })} style={inputStyle}>{Object.entries(TEAM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <div style={labelStyle}>Assigned employees
              <div style={{display:"grid",gap:6,marginTop:3}}>{world.player.personnel.length ? world.player.personnel.map((p: Personnel) => { const checked=selected.assignedPersonnelIds.includes(p.id); return <label key={p.id} style={{display:"flex",gap:7,alignItems:"center",fontWeight:400}}><input type="checkbox" checked={checked} onChange={() => updateSelected({assignedPersonnelIds: checked ? selected.assignedPersonnelIds.filter(id=>id!==p.id) : [...selected.assignedPersonnelIds,p.id]})}/>{p.name} · {p.role.replace("_"," ")} · {Math.round(p.skill*100)}%</label>; }) : <span style={{color:C.faint,fontWeight:400}}>Hire employees in Personnel first.</span>}</div>
            </div>
            {selected.team === "product" && <>
              <label style={labelStyle}>Category mandate<select value={selected.productKey ?? ""} onChange={(e) => updateSelected({ productKey: e.target.value || null, skuId: null })} style={inputStyle}><option value="">Choose product type…</option>{world.cfg.products.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
              <label style={labelStyle}>Link launched product<select value={selected.skuId ?? ""} onChange={(e) => { const sku = world.player.skus.find((s) => s.id === e.target.value); updateSelected({ skuId: e.target.value || null, productKey: sku?.productKey ?? selected.productKey }); }} style={inputStyle}><option value="">Concept / not launched</option>{world.player.skus.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}</select></label>
              <button style={{ ...bigBtn, width: "100%", marginTop: 4 }} onClick={openCreator}>＋ Create product in simulation</button>
            </>}
          </>}
          {selected.id !== "founder-office" && <button style={{ ...ctrlBtn, width: "100%", marginTop: 12, color: C.red }} onClick={() => { world.player.cash += Math.round(selected.buildCost * 0.25); setRooms((rs) => rs.filter((r) => r.id !== selected.id)); setSelectedId(null); }}>Demolish room</button>}
        </>}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 15 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Company footprint</div>
        <Metric label="Rooms" value={String(rooms.length)} />
        <Metric label="Committed build capex" value={fmtMoney(totalBuildCost)} />
        <Metric label="Room operating cost" value={`${fmtMoney(monthlyRoomCost)}/mo`} />
        <Metric label="Factory capacity" value={`${factoryUnits.toLocaleString()} units/mo`} />
        <Metric label="Supplier capacity" value={`${supplierUnits.toLocaleString()} units/mo`} />
        <Metric label="Warehouse utilization" value={`${inventoryUnits.toLocaleString()} / ${warehouseUnits.toLocaleString()}`} />
        <Metric label="Product mandates" value={String(productRooms.length)} />
        <Metric label="Active SKUs" value={String(world.player.skus.filter((s) => s.status === "active").length)} />
      </div>

      <div style={{ background: blockers.length ? "#fff7ed" : "#f0fdf4", border: `1px solid ${blockers.length ? "#fed7aa" : "#bbf7d0"}`, borderRadius: 12, padding: 15 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{blockers.length ? "Management attention" : "Operating model complete"}</div>
        {blockers.length ? blockers.map((b) => <div key={b} style={{ fontSize: 12, color: "#9a3412", marginTop: 7 }}>● {b}</div>) : <div style={{ fontSize: 12, color: "#166534" }}>The basic product-to-market chain is in place.</div>}
      </div>
    </aside>
  </div>;
}

function FlowStep({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return <div style={{ border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`, background: ok ? "#f0fdf4" : "#fef2f2", borderRadius: 8, padding: "7px 8px" }}><div style={{ color: ok ? "#166534" : "#991b1b", fontWeight: 700 }}>{ok ? "✓" : "!"} {label}</div><div style={{ color: C.faint, marginTop: 2 }}>{detail}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: `1px solid ${C.line}`, fontSize: 12 }}><span style={{ color: C.dim }}>{label}</span><b>{value}</b></div>;
}

const labelStyle: React.CSSProperties = { display: "grid", gap: 5, fontSize: 12, color: C.dim, marginTop: 10, fontWeight: 600 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 9px", background: "white", color: C.ink, fontSize: 12 };
