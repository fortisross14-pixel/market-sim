import React, { useState } from "react";
import { C, bigBtn, ctrlBtn, fmtMoney, fmtNum } from "../theme";
import { Panel, Slider, FieldLabel } from "../components";
import { PACKAGING } from "../../engine/industries";
import type { World } from "../../engine/types";

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

      {skus.length === 0 && <Panel title="No products"><div style={{ color: C.faint, fontSize: 13 }}>Launch your first product below.</div></Panel>}

      {skus.map((sku, si) => <ProductCard key={si} world={world} si={si} sku={sku} live={live}
        produce={produce} setProductPrice={setProductPrice} setProductQuality={setProductQuality} openDistribution={openDistribution} />)}

      <button style={{ ...bigBtn, background: world.brand.color, width: "100%", marginTop: 4 }} onClick={openCreator}>+ Launch a new product</button>
    </div>
  );
}

function ProductCard({ world, si, sku, live, produce, setProductPrice, setProductQuality, openDistribution }: any) {
  const r = live?.skuResults?.[si] ?? {};
  const pkgLabel = PACKAGING.find((p: any) => p.key === sku.packaging)?.label ?? sku.packaging;
  const [batch, setBatch] = useState(20000);
  const [price, setPrice] = useState(sku.listPrice);
  const [quality, setQuality] = useState(sku.quality);
  const [editing, setEditing] = useState(false);

  const batchCost = batch * sku.unitCost;
  const affordable = batchCost <= world.player.cash;
  const maxBatch = Math.max(1000, Math.floor(world.player.cash / Math.max(0.01, sku.unitCost)));
  const perceptionGap = Math.abs(sku.quality - sku.perceivedQuality);
  const contribPos = (sku.contributionTotal ?? 0) >= 0;

  return (
    <Panel title={sku.name}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {/* left: stats */}
        <div style={{ flex: "1 1 240px" }}>
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
                Perception is catching up to actual quality — {sku.quality > sku.perceivedQuality ? "your improvements aren't fully recognized yet" : "your reputation still rests on the old, better product"}.
              </div>
            )}
          </div>
          <div style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>{pkgLabel} · {sku.channels.length === 0 ? <span style={{ color: C.red }}>not distributed</span> : `${sku.channels.length} channel(s)`}</div>
        </div>

        {/* right: actions */}
        <div style={{ flex: "1 1 240px" }}>
          <FieldLabel>Manufacture a batch</FieldLabel>
          <Slider label="Batch size" min={1000} max={maxBatch} step={1000} value={Math.min(batch, maxBatch)} fmt={(v) => fmtNum(v)} onChange={setBatch} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: affordable ? C.dim : C.red, marginBottom: 8 }}>
            <span>Cost: {fmtMoney(batchCost)}</span><span>Cash: {fmtMoney(world.player.cash)}</span>
          </div>
          <button style={{ ...bigBtn, background: affordable ? world.brand.color : C.line, color: affordable ? "#06121c" : C.faint, width: "100%" }}
            disabled={!affordable} onClick={() => produce(si, batch)}>
            Manufacture {fmtNum(batch)} units
          </button>

          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button style={{ ...ctrlBtn, flex: 1 }} onClick={() => setEditing((e) => !e)}>{editing ? "Close edit" : "Edit price / quality"}</button>
            <button style={{ ...ctrlBtn, flex: 1 }} onClick={() => openDistribution(si)}>Distribution / Sales</button>
          </div>

          {editing && (
            <div style={{ marginTop: 10, padding: 10, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8 }}>
              <Slider label="List price" min={5} max={150} step={1} value={price} fmt={(v) => `$${v}`} onChange={setPrice} />
              <button style={{ ...ctrlBtn, width: "100%", marginBottom: 10 }} onClick={() => setProductPrice(si, price)}>Apply price</button>
              <Slider label="Quality (next batch)" min={0.1} max={1} step={0.01} value={quality} fmt={(v) => v.toFixed(2)} onChange={setQuality} />
              <div style={{ color: C.faint, fontSize: 11, margin: "2px 0 8px" }}>
                Raising quality costs more per unit and improves perception only gradually — existing customers remember the old product.
              </div>
              <button style={{ ...ctrlBtn, width: "100%" }} onClick={() => setProductQuality(si, quality)}>Set quality for next batch</button>
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
