import React, { useState, useEffect } from "react";
import { C, bigBtn, ctrlBtn, fmtMoney } from "../theme";
import { FieldLabel, TextInput, ChoiceCard, Slider, Seg, Econ } from "../components";
import { AXES, METHODS, CHANNEL_TYPES } from "../../engine/industries";
import { deriveUnitCost, deriveQuality, contractReach } from "../../engine/economics";
import { normAxis, type ProductSpec } from "../../engine/world";
import type { World, ChannelType } from "../../engine/types";

export function ProductCreator({ world, onCreate, onClose }: { world: World; onCreate: (s: ProductSpec) => void; onClose: () => void }) {
  const cfg = world.cfg;
  const [productKey, setProductKey] = useState(cfg.products[0].key);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"outsource" | "own">("outsource");
  const [materialsQ, setMaterialsQ] = useState(0.5);
  const [productionQ, setProductionQ] = useState(0.5);
  const [online, setOnline] = useState(0.4);
  const [gAge, setGAge] = useState("25-39");
  const [gClass, setGClass] = useState("Middle");
  const [gGender, setGGender] = useState("Female");
  const [gLeaning, setGLeaning] = useState("Neutral");
  const pt = cfg.products.find((p) => p.key === productKey)!;
  const [listPrice, setListPrice] = useState(Math.round((pt.priceBand[0] + pt.priceBand[1]) / 2));
  const [batch, setBatch] = useState(60000);

  const unitCost = deriveUnitCost(pt, method, materialsQ, productionQ);
  const quality = deriveQuality(materialsQ, productionQ);
  const batchCost = batch * unitCost;
  const marginPct = (listPrice - unitCost) / listPrice;
  const canAfford = batchCost <= world.player.cash;

  return (
    <Modal onClose={onClose} title={<>New Product — <span style={{ color: world.brand.color }}>{world.brand.name}</span></>} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <FieldLabel>Product type</FieldLabel>
          <select value={productKey} onChange={(e) => { const k = e.target.value; setProductKey(k); const p = cfg.products.find((x) => x.key === k)!; setListPrice(Math.round((p.priceBand[0] + p.priceBand[1]) / 2)); }}
            style={{ width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, color: C.ink, fontSize: 14 }}>
            {cfg.products.map((p) => <option key={p.key} value={p.key}>{p.label}{p.naturalLean ? "  ◆" : ""}</option>)}
          </select>
          {pt.naturalLean && <div style={{ color: C.violet, fontSize: 11, marginTop: 4 }}>◆ This type naturally leans toward certain customers regardless of your aim.</div>}
          <div style={{ height: 12 }} />
          <FieldLabel>Product name</FieldLabel>
          <TextInput placeholder="e.g. Daily Glow" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ height: 14 }} />
          <FieldLabel>Who is it for? (target in the cube)</FieldLabel>
          <div style={{ display: "grid", gap: 8 }}>
            <Seg label="Age" opts={AXES.age} val={gAge} set={setGAge} />
            <Seg label="Class" opts={AXES.class} val={gClass} set={setGClass} />
            <Seg label="Gender" opts={AXES.gender} val={gGender} set={setGGender} />
            <Seg label="Leaning" opts={AXES.leaning} val={gLeaning} set={setGLeaning} />
          </div>
          <div style={{ marginTop: 8, color: C.faint, fontSize: 11 }}>This industry weights: {Object.entries(cfg.axisWeight).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(" · ")}.</div>
          <div style={{ height: 14 }} />
          <FieldLabel>Production</FieldLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {Object.entries(METHODS).map(([k, m]) => (
              <ChoiceCard key={k} active={method === k} disabled={!m.available} onClick={() => m.available && setMethod(k as "outsource" | "own")} accent={world.brand.color}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{m.label}</div>
                <div style={{ color: C.dim, fontSize: 10.5, lineHeight: 1.35, marginTop: 3 }}>{m.note}</div>
              </ChoiceCard>
            ))}
          </div>
          <Slider label="Materials quality" min={0} max={1} step={.01} value={materialsQ} fmt={(v) => v.toFixed(2)} onChange={setMaterialsQ} />
          <Slider label="Production quality" min={0} max={1} step={.01} value={productionQ} fmt={(v) => v.toFixed(2)} onChange={setProductionQ} />
          <Slider label="Online readiness" min={0} max={1} step={.01} value={online} fmt={(v) => v.toFixed(2)} onChange={setOnline} />
        </div>
        <div>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <FieldLabel>Derived economics</FieldLabel>
            <Econ k="Unit cost" v={`${cfg.currency}${unitCost.toFixed(2)}`} color={C.amber} />
            <Econ k="Quality attribute" v={quality.toFixed(2)} color={C.cyan} />
            <div style={{ height: 8 }} />
            <Slider label="List price" min={pt.priceBand[0]} max={Math.round(pt.priceBand[1] * 1.4)} step={1} value={listPrice} fmt={(v) => `${cfg.currency}${v}`} onChange={setListPrice} />
            <Econ k="Margin / unit (pre-retail)" v={`${cfg.currency}${(listPrice - unitCost).toFixed(2)} (${(marginPct * 100).toFixed(0)}%)`} color={marginPct > 0 ? C.green : C.red} />
          </div>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
            <FieldLabel>Initial production batch</FieldLabel>
            <Slider label="Units to manufacture" min={0} max={300000} step={5000} value={batch} fmt={(v) => v.toLocaleString()} onChange={setBatch} />
            <Econ k="Batch cost (cash now)" v={fmtMoney(batchCost)} color={canAfford ? C.ink : C.red} />
            <Econ k="Cash after" v={fmtMoney(world.player.cash - batchCost)} color={canAfford ? C.dim : C.red} />
            {!canAfford && <div style={{ color: C.red, fontSize: 11, marginTop: 6 }}>Not enough cash for this batch.</div>}
            <div style={{ marginTop: 10, color: C.faint, fontSize: 11, lineHeight: 1.5 }}>Producing spends cash now; you recover it as the stock sells — through channel payment terms.</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button style={ctrlBtn} onClick={onClose}>Cancel</button>
        <button style={{ ...bigBtn, background: world.brand.color, opacity: (name.trim() && canAfford) ? 1 : .5 }} disabled={!name.trim() || !canAfford}
          onClick={() => onCreate({ name, productKey, method, materialsQ, productionQ, online, listPrice, batch, gAge: normAxis("age", gAge), gClass: normAxis("class", gClass), gGender: normAxis("gender", gGender), gLeaning: normAxis("leaning", gLeaning) })}>
          Manufacture & launch
        </button>
      </div>
    </Modal>
  );
}

export function ContractModal({ world, onSign, onClose }: { world: World; onSign: (t: ChannelType, cut: number) => void; onClose: () => void }) {
  const [type, setType] = useState<ChannelType>("retail");
  const t = CHANNEL_TYPES[type];
  const [marginCut, setMarginCut] = useState(t.marginCut);
  useEffect(() => { setMarginCut(CHANNEL_TYPES[type].marginCut); }, [type]);
  const reach = contractReach({ type, marginCut });
  const accept = marginCut >= t.marginCut * 0.9;
  return (
    <Modal onClose={onClose} title="Negotiate Distribution">
      <FieldLabel>Channel type</FieldLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {(Object.entries(CHANNEL_TYPES) as [ChannelType, typeof t][]).map(([k, c]) => (
          <ChoiceCard key={k} active={type === k} onClick={() => setType(k)}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</div>
            <div style={{ color: C.dim, fontSize: 10.5, lineHeight: 1.35, marginTop: 3 }}>reach {(c.baseReach * 100).toFixed(0)}% · cut {(c.marginCut * 100).toFixed(0)}% · pays in {c.paymentDays}d</div>
          </ChoiceCard>
        ))}
      </div>
      <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
        <Slider label="Margin cut you concede" min={0} max={0.6} step={0.01} value={marginCut} fmt={(v) => `${(v * 100).toFixed(0)}%`} onChange={setMarginCut} />
        <Econ k="Slotting / fixed fee" v={fmtMoney(t.slotting) + "/Q"} color={C.amber} />
        <Econ k="Resulting reach" v={`${(reach * 100).toFixed(0)}%`} color={C.cyan} />
        <Econ k="Payment terms" v={`${t.paymentDays} days`} color={t.paymentDays > 60 ? C.red : C.violet} />
        <Econ k="Awareness halo" v={`+${(t.awarenessBoost * reach).toFixed(2)}`} color={C.violet} />
        <div style={{ marginTop: 8, color: accept ? C.green : C.red, fontSize: 12 }}>{accept ? "✓ Retailer will accept these terms." : "✗ Too low — they'll walk. Concede more margin."}</div>
        <div style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>Long payment terms tie up cash even when sales are healthy. You keep {((1 - marginCut) * 100).toFixed(0)}% of each sale here.</div>
      </div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button style={ctrlBtn} onClick={onClose}>Cancel</button>
        <button style={{ ...bigBtn, opacity: accept ? 1 : .5 }} disabled={!accept} onClick={() => onSign(type, marginCut)}>Sign contract</button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,8,12,.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22, width: "100%", maxWidth: wide ? 760 : 560, maxHeight: "92vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2><button style={ctrlBtn} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
