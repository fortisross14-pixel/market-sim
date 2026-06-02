import React, { useState } from "react";
import { C, bigBtn, ctrlBtn, fmtMoney, fmtNum } from "../theme";
import { Panel, Slider, FieldLabel } from "../components";
import { PACKAGING, LICENSES } from "../../engine/industries";
import { PRODUCT_RARITY_DEFS, RARITY_DEFS } from "../../engine/types";
import type { World } from "../../engine/types";

import { canCreateProduct, warehouseCapacity, pmCapacity } from "../../engine/capacity";

export function ProductsView({ world, produce, setProductPrice, setProductQuality, openDistribution, openCreator }: {
  world: World;
  produce: (si: number, qty: number) => void;
  setProductPrice: (si: number, price: number) => void;
  setProductQuality: (si: number, q: number) => void;
  openDistribution: (si: number) => void;
  openCreator: () => void;
}) {
  const live = world.live;
  const skus = world.player.skus;

  return (
    <div>
      <Panel title={`${world.cfg.label} · ${world.brand.name}`}>
        <div style={{ color: C.dim, fontSize: 13, marginBottom: 4 }}>
          {skus.length} product{skus.length !== 1 ? "s" : ""} launched. Editing price or quality applies to the next batch you manufacture — and a popular product's reputation moves slowly, so quality changes take time to register.
        </div>
      </Panel>

      {skus.length === 0 && (
        <Panel title="Getting Started">
          <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.7 }}>
            {world.player.personnel.filter((p) => p.role === "product_manager").length === 0 ? (
              <>You need a <strong style={{ color: C.ink }}>Product Manager</strong> before you can design anything. Go to <strong style={{ color: C.cyan }}>Management → Personnel</strong> and hire one.</>
            ) : world.player.contracts.length === 0 ? (
              <>You have a PM — now you need somewhere to sell. Go to <strong style={{ color: C.cyan }}>Operations → Distribution</strong> to sign your first retail partner, then come back here to start designing.</>
            ) : (
              <>You're set up with a PM and distribution. Hit <strong style={{ color: C.cyan }}>Design a new product</strong> below to start your first product design.</>
            )}
          </div>
        </Panel>
      )}

      {skus.map((sku, si) => <ProductCard key={si} world={world} si={si} sku={sku} live={live}
        produce={produce} setProductPrice={setProductPrice} setProductQuality={setProductQuality} openDistribution={openDistribution} />)}

      {(() => {
        const check = canCreateProduct(world);
        const whCap = warehouseCapacity(world);
        const pms = world.player.personnel.filter((p) => p.role === "product_manager").length;
        return (
          <div>
            <div style={{ color: C.dim, fontSize: 12, marginBottom: 6 }}>
              Products: {skus.length}/{whCap} (warehouse) · PMs: {pms} ({pms * 2} product slots)
            </div>
            <button style={{ ...bigBtn, background: check.ok ? world.brand.color : C.line, color: check.ok ? "#06121c" : C.faint, width: "100%" }}
              disabled={!check.ok} onClick={openCreator}>
              + Design a new product
            </button>
            {!check.ok && <div style={{ color: C.amber, fontSize: 12, marginTop: 6 }}>{check.reason}</div>}
          </div>
        );
      })()}
    </div>
  );
}

function ProductCard({ world, si, sku, live, produce, setProductPrice, setProductQuality, openDistribution }: { world: World; si: number; sku: import("../../engine/types").SKU; live: any; produce: any; setProductPrice: any; setProductQuality: any; openDistribution: any }) {
  const r = live?.skuResults?.[si] ?? {};
  const pkgLabel = PACKAGING.find((p: any) => p.key === sku.packaging)?.label ?? sku.packaging;
  const [batch, setBatch] = useState(20000);
  const [price, setPrice] = useState(sku.listPrice);
  const [quality, setQuality] = useState(sku.quality);
  const [editing, setEditing] = useState(false);
  const rd = PRODUCT_RARITY_DEFS[sku.rarity ?? "common"];
  const pm = world.player.personnel.find((p) => p.id === sku.assignedPmId);
  const depthLabel = ({ quick: "Quick", normal: "Normal", detailed: "Detailed" } as any)[sku.designDepth] ?? "Normal";

  // ---- DESIGNING ----
  if (sku.status === "designing") {
    const totalDays = (({ quick: 14, normal: 45, detailed: 90 } as any)[sku.designDepth]) ?? 45;
    const progress = 1 - sku.designDaysLeft / totalDays;
    return (
      <Panel title={sku.name}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>🎨 Designing…</span>
          <span style={{ color: C.dim, fontSize: 11 }}>{depthLabel} depth · {sku.designDaysLeft} days left</span>
        </div>
        {pm && <div style={{ color: C.dim, fontSize: 12, marginBottom: 8 }}>PM: {pm.name} <span style={{ color: RARITY_DEFS[pm.rarity].color }}>★ {RARITY_DEFS[pm.rarity].label}</span> (locked)</div>}
        <div style={{ height: 8, background: C.grid, borderRadius: 4, marginBottom: 6 }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: C.amber, borderRadius: 4, transition: "width 0.3s" }} />
        </div>
        <div style={{ color: C.faint, fontSize: 11 }}>Mfg quality: {(sku.quality * 100).toFixed(0)} · Est. design quality: {(sku.designQuality * 100).toFixed(0)} · Unit cost: ${sku.unitCost.toFixed(2)}</div>
      </Panel>
    );
  }

  // ---- DESIGNED (ready to manufacture) ----
  if (sku.status === "designed") {
    const batchCost = batch * sku.unitCost;
    const affordable = batchCost <= world.player.cash;
    const maxBatch = Math.max(1000, Math.floor(world.player.cash / Math.max(0.01, sku.unitCost)));
    return (
      <Panel title={sku.name}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
          <span style={{ color: rd.color, fontWeight: 700, fontSize: 13 }}>★ {rd.label}</span>
          <span style={{ color: C.green, fontWeight: 600, fontSize: 12 }}>✓ Design complete</span>
        </div>
        <div style={{ color: C.dim, fontSize: 12, marginBottom: 12 }}>
          Mfg {(sku.quality * 100).toFixed(0)} · Design {(sku.designQuality * 100).toFixed(0)} · Unit cost ${sku.unitCost.toFixed(2)} · Price ${sku.listPrice}
        </div>
        <FieldLabel>Manufacture first batch</FieldLabel>
        <Slider label="Batch size" min={1000} max={maxBatch} step={1000} value={Math.min(batch, maxBatch)} fmt={(v) => fmtNum(v)} onChange={setBatch} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: affordable ? C.dim : C.red, marginBottom: 8 }}>
          <span>Cost: {fmtMoney(batchCost)}</span><span>Cash: {fmtMoney(world.player.cash)}</span>
        </div>
        <button style={{ ...bigBtn, background: affordable ? world.brand.color : C.line, color: affordable ? "#06121c" : C.faint, width: "100%" }}
          disabled={!affordable} onClick={() => produce(si, batch)}>
          Manufacture {fmtNum(batch)} units (~{Math.max(3, Math.round(batch / 5000))}d)
        </button>
      </Panel>
    );
  }

  // ---- MANUFACTURING ----
  if (sku.status === "manufacturing") {
    const totalMfgDays = Math.max(3, Math.round(sku.mfgBatchSize / 5000));
    const progress = 1 - sku.mfgDaysLeft / totalMfgDays;
    return (
      <Panel title={sku.name}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ color: C.cyan, fontWeight: 600, fontSize: 13 }}>🏭 Manufacturing…</span>
          <span style={{ color: C.dim, fontSize: 11 }}>{fmtNum(sku.mfgBatchSize)} units · {sku.mfgDaysLeft} days left</span>
        </div>
        <div style={{ height: 8, background: C.grid, borderRadius: 4, marginBottom: 6 }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: C.cyan, borderRadius: 4, transition: "width 0.3s" }} />
        </div>
        <div style={{ color: C.faint, fontSize: 11 }}>Once complete, distribute through your retail partners and start marketing.</div>
      </Panel>
    );
  }

  // ---- ACTIVE (on shelves, selling) ----
  const batchCost = batch * sku.unitCost;
  const affordable = batchCost <= world.player.cash;
  const maxBatch = Math.max(1000, Math.floor(world.player.cash / Math.max(0.01, sku.unitCost)));
  const perceptionGap = Math.abs(sku.quality - sku.perceivedQuality);
  const contribPos = (sku.contributionTotal ?? 0) >= 0;

  return (
    <Panel title={sku.name}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ color: rd.color, fontWeight: 700, fontSize: 13 }}>★ {rd.label}</span>
        <span style={{ color: C.dim, fontSize: 11 }}>Mfg {(sku.quality * 100).toFixed(0)} · Design {(sku.designQuality * 100).toFixed(0)}</span>
        {sku.license && <span style={{ color: C.violet, fontSize: 11 }}>🏷 {LICENSES.find((l) => l.key === sku.license)?.label ?? sku.license}</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <div style={{ flex: "1 1 240px" }}>
          <LifecycleBar label="Novelty" value={sku.novelty ?? 1} color={C.cyan} />
          <LifecycleBar label="Fame" value={sku.fame ?? 0} color={C.amber} />
          <div style={{ height: 6 }} />
          <Stat k="Lifetime units" v={fmtNum(sku.unitsSoldTotal ?? 0)} />
          <Stat k="Lifetime contribution" v={fmtMoney(sku.contributionTotal ?? 0)} color={contribPos ? C.green : C.red} />
          <Stat k="In stock" v={sku.inventory < 1 ? "OUT" : fmtNum(sku.inventory)} color={sku.inventory < 1 ? C.red : C.ink} />
          <Stat k="Units / quarter (now)" v={fmtNum(r.units ?? 0)} />
          <Stat k="List price" v={`$${sku.listPrice}`} />
          <Stat k="Unit cost" v={`$${sku.unitCost.toFixed(2)}`} />
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: C.dim }}>Quality (actual vs perceived)</span>
              <span style={{ color: C.dim, fontFamily: "ui-monospace" }}>{(sku.quality * 100).toFixed(0)} / {(sku.perceivedQuality * 100).toFixed(0)}</span>
            </div>
            <div style={{ height: 8, background: C.grid, borderRadius: 4, position: "relative" }}>
              <div style={{ width: `${sku.perceivedQuality * 100}%`, height: "100%", background: C.violet, borderRadius: 4 }} />
              <div style={{ position: "absolute", top: -2, left: `calc(${sku.quality * 100}% - 1px)`, width: 2, height: 12, background: C.ink }} />
            </div>
            {perceptionGap > 0.05 && (
              <div style={{ color: C.amber, fontSize: 11, marginTop: 4 }}>
                Perception catching up — {sku.quality > sku.perceivedQuality ? "improvements not yet recognized" : "old reputation lingers"}.
              </div>
            )}
          </div>
          <div style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>{pkgLabel} · {sku.channels.length === 0 ? <span style={{ color: C.red }}>not distributed</span> : `${sku.channels.length} channel(s)`}</div>
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <FieldLabel>Manufacture more</FieldLabel>
          <Slider label="Batch size" min={1000} max={maxBatch} step={1000} value={Math.min(batch, maxBatch)} fmt={(v) => fmtNum(v)} onChange={setBatch} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: affordable ? C.dim : C.red, marginBottom: 8 }}>
            <span>Cost: {fmtMoney(batchCost)}</span><span>Cash: {fmtMoney(world.player.cash)}</span>
          </div>
          <button style={{ ...bigBtn, background: affordable ? world.brand.color : C.line, color: affordable ? "#06121c" : C.faint, width: "100%" }}
            disabled={!affordable} onClick={() => produce(si, batch)}>
            Manufacture {fmtNum(batch)} units
          </button>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button style={{ ...ctrlBtn, flex: 1 }} onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Edit price / quality"}</button>
            <button style={{ ...ctrlBtn, flex: 1 }} onClick={() => openDistribution(si)}>Distribution</button>
          </div>
          {editing && (
            <div style={{ marginTop: 10, padding: 10, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8 }}>
              <Slider label="List price" min={5} max={150} step={1} value={price} fmt={(v) => `$${v}`} onChange={setPrice} />
              <button style={{ ...ctrlBtn, width: "100%", marginBottom: 10 }} onClick={() => setProductPrice(si, price)}>Apply price</button>
              <Slider label="Quality (next batch)" min={0.1} max={1} step={0.01} value={quality} fmt={(v) => v.toFixed(2)} onChange={setQuality} />
              <button style={{ ...ctrlBtn, width: "100%" }} onClick={() => setProductQuality(si, quality)}>Set quality</button>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

const Stat = ({ k, v, color = C.ink }: { k: string; v: string; color?: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
    <span style={{ color: C.dim }}>{k}</span><span style={{ color, fontFamily: "ui-monospace", fontWeight: 600 }}>{v}</span>
  </div>
);

function LifecycleBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
        <span style={{ color: C.dim }}>{label}</span>
        <span style={{ color, fontFamily: "ui-monospace" }}>{(value * 100).toFixed(0)}</span>
      </div>
      <div style={{ height: 5, background: C.grid, borderRadius: 3 }}>
        <div style={{ width: `${value * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}
