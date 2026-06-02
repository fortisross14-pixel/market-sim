import React, { useState, useEffect } from "react";
import { C, bigBtn, ctrlBtn, fmtMoney } from "../theme";
import { FieldLabel, TextInput, ChoiceCard, Slider, Seg, Econ } from "../components";
import { AXES, METHODS, CHANNEL_TYPES, PACKAGING, packagingNeedBias, LICENSES, RETAIL_PARTNERS } from "../../engine/industries";
import { deriveUnitCost, deriveQuality, contractReach } from "../../engine/economics";
import { normAxis, type ProductSpec } from "../../engine/world";
import { segmentStats } from "../../engine/segments";
import type { World, ChannelType, DesignDepth } from "../../engine/types";
import { DESIGN_DEPTHS } from "../../engine/types";

export function ProductCreator({ world, onCreate, onClose }: { world: World; onCreate: (s: ProductSpec) => void; onClose: () => void }) {
  const cfg = world.cfg;
  const [productKey, setProductKey] = useState(cfg.products[0].key);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"outsource" | "own">("outsource");
  const [materialsQ, setMaterialsQ] = useState(0.5);
  const [productionQ, setProductionQ] = useState(0.5);
  const [online, setOnline] = useState(0.4);
  const [intendedSeg, setIntendedSeg] = useState("");
  const pt = cfg.products.find((p) => p.key === productKey)!;
  const [listPrice, setListPrice] = useState(Math.round((pt.priceBand[0] + pt.priceBand[1]) / 2));
  const [designDepth, setDesignDepth] = useState<import("../../engine/types").DesignDepth>("normal");
  const [attributes, setAttributes] = useState<Record<string, number>>(
    () => Object.fromEntries(cfg.needs.map((n) => [n.key, pt.defaultAttributes?.[n.key] ?? 0.4]))
  );
  // when product type changes, reset attributes to its defaults
  React.useEffect(() => {
    const p = cfg.products.find((x) => x.key === productKey)!;
    setAttributes(Object.fromEntries(cfg.needs.map((n) => [n.key, p.defaultAttributes?.[n.key] ?? 0.4])));
  }, [productKey]);

  const unitCost = deriveUnitCost(pt, method, materialsQ, productionQ);
  const quality = deriveQuality(materialsQ, productionQ);
  const depthDef = DESIGN_DEPTHS[designDepth];
  const marginPct = (listPrice - unitCost) / listPrice;
  const canStart = name.trim().length > 0;

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
          <FieldLabel>Intended audience (optional — guidance only)</FieldLabel>
          {world.savedSegments.length === 0 ? (
            <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, color: C.faint, fontSize: 12, lineHeight: 1.5 }}>
              No segments created yet. Create a segment (Segments tab) and research it to get advice here. Either way, who actually buys this emerges from its attributes, packaging, price, and channel — you don't target a group directly.
            </div>
          ) : (
            <>
              <select value={intendedSeg} onChange={(e) => setIntendedSeg(e.target.value)}
                style={{ width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, color: C.ink, fontSize: 14 }}>
                <option value="">— none —</option>
                {world.savedSegments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {intendedSeg && (() => {
                const seg = world.savedSegments.find((s) => s.id === intendedSeg)!;
                const researched = world.revealed.market_map;
                if (!researched) return <div style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>Run a Population Map Scan (Intelligence) to unlock advice for this segment.</div>;
                const st = segmentStats(world, seg.filter);
                const topNeeds = Object.entries(st.needPref).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => cfg.needs.find((n) => n.key === k)?.label).join(" & ");
                return (
                  <div style={{ background: C.panel2, border: `1px solid ${C.violet}`, borderRadius: 8, padding: 10, marginTop: 6, color: C.dim, fontSize: 11.5, lineHeight: 1.55 }}>
                    <span style={{ color: C.violet }}>Advice for {seg.name}:</span> they most want <b style={{ color: C.ink }}>{topNeeds}</b>. Avg spend ${st.avgSpend.toFixed(0)}/yr — {st.avgSpend > 250 ? "they'll pay for quality." : "they're price-conscious."} Tune attributes below to match; set channel & packaging after launch in Distribution.
                  </div>
                );
              })()}
            </>
          )}
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
          <div style={{ height: 6 }} />
          <FieldLabel>Product attributes (what need it serves)</FieldLabel>
          {cfg.needs.map((n) => (
            <Slider key={n.key} label={n.label} min={0} max={1} step={.01} value={attributes[n.key] ?? 0.4} fmt={(v) => v.toFixed(2)}
              onChange={(v) => setAttributes((a) => ({ ...a, [n.key]: v }))} />
          ))}
          <div style={{ color: C.faint, fontSize: 11, marginTop: -4 }}>Different customers want different things. A product can win a demographic on needs — or lose it.</div>
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
            <FieldLabel>Design depth</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
              {(Object.keys(DESIGN_DEPTHS) as DesignDepth[]).map((d) => {
                const dd = DESIGN_DEPTHS[d];
                return (
                  <ChoiceCard key={d} active={designDepth === d} onClick={() => setDesignDepth(d)}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{dd.label}</div>
                    <div style={{ color: C.dim, fontSize: 10, lineHeight: 1.3, marginTop: 3 }}>{dd.days} days · ×{dd.qualityMult} design quality</div>
                  </ChoiceCard>
                );
              })}
            </div>
            <Econ k="Design time" v={`${depthDef.days} days`} color={C.cyan} />
            <Econ k="Design quality multiplier" v={`×${depthDef.qualityMult}`} color={depthDef.qualityMult > 1 ? C.green : depthDef.qualityMult < 1 ? C.amber : C.dim} />
            <div style={{ color: C.faint, fontSize: 11, marginTop: 6 }}>The PM will be locked during design. Manufacturing is a separate step after the design is complete.</div>
            <div style={{ marginTop: 10, color: C.faint, fontSize: 11, lineHeight: 1.5 }}>Producing spends cash now; you recover it as the stock sells — through channel payment terms.</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button style={ctrlBtn} onClick={onClose}>Cancel</button>
        <button style={{ ...bigBtn, background: world.brand.color, opacity: canStart ? 1 : .5 }} disabled={!canStart}
          onClick={() => onCreate({ name, productKey, method, materialsQ, productionQ, online, listPrice, gAge: 0.5, gClass: 0.5, gGender: 0.5, gLeaning: 0.5, gGeography: 0.5, gFamily: 0.5, attributes, designDepth })}>
          Start Design ({depthDef.days} days) & launch
        </button>
      </div>
    </Modal>
  );
}

export function DistributionModal({ world, skuIndex, setPackaging, setProductPrice, setLicense, toggleChannel, openContract, onClose }: {
  world: World; skuIndex: number;
  setPackaging: (si: number, pkg: string) => void;
  setProductPrice: (si: number, price: number) => void;
  setLicense: (si: number, key: string | null) => void;
  toggleChannel: (si: number, t: ChannelType) => void;
  openContract: () => void; onClose: () => void;
}) {
  const sku = world.player.skus[skuIndex];
  const pt = world.cfg.products.find((p) => p.key === sku.productKey)!;
  const availableChannels = Array.from(new Set(world.player.contracts.map((c) => c.type)));
  return (
    <Modal onClose={onClose} title={<>Distribution & Sales — <span style={{ color: world.brand.color }}>{sku.name}</span></>} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <FieldLabel>Packaging</FieldLabel>
          <div style={{ color: C.faint, fontSize: 11, marginBottom: 8 }}>Packaging shifts who resonates and amplifies certain needs. Pick the vibe.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {PACKAGING.map((pk) => {
              const on = sku.packaging === pk.key;
              const bias = packagingNeedBias(world.cfg.id, pk.key);
              const amp = Object.keys(bias).map((k) => world.cfg.needs.find((n) => n.key === k)?.label).filter(Boolean).join(", ");
              return (
                <button key={pk.key} onClick={() => setPackaging(skuIndex, pk.key)}
                  style={{ textAlign: "left", background: on ? C.panel2 : C.bg, border: `1px solid ${on ? world.brand.color : C.line}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: C.ink }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{pk.label}</div>
                  <div style={{ color: C.dim, fontSize: 10, marginTop: 2 }}>
                    {pk.ageLean < -0.2 ? "skews young" : pk.ageLean > 0.2 ? "skews older" : "age-neutral"}{pk.classLean > 0.3 ? " · premium" : pk.classLean < -0.2 ? " · budget" : ""}
                  </div>
                  {amp && <div style={{ color: C.violet, fontSize: 10, marginTop: 1 }}>boosts {amp}</div>}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <FieldLabel>Price</FieldLabel>
            <Slider label="List price" min={pt.priceBand[0]} max={Math.round(pt.priceBand[1] * 1.4)} step={1} value={sku.listPrice} fmt={(v) => `${world.cfg.currency}${v}`} onChange={(v) => setProductPrice(skuIndex, v)} />
            <Econ k="Margin / unit (pre-retail)" v={`${world.cfg.currency}${(sku.listPrice - sku.unitCost).toFixed(2)}`} color={sku.listPrice > sku.unitCost ? C.green : C.red} />
          </div>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
            <FieldLabel>Channels carrying this product</FieldLabel>
            {availableChannels.length === 0 ? (
              <div style={{ color: C.faint, fontSize: 12, lineHeight: 1.5 }}>
                You have no channel contracts yet. <button style={{ ...ctrlBtn, marginTop: 6 }} onClick={openContract}>Negotiate a contract</button>
              </div>
            ) : (
              <>
                {availableChannels.map((ch) => {
                  const on = sku.channels.includes(ch);
                  return (
                    <div key={ch} onClick={() => toggleChannel(skuIndex, ch)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", marginBottom: 6, background: on ? C.panel : "transparent", border: `1px solid ${on ? world.brand.color : C.line}`, borderRadius: 8, cursor: "pointer" }}>
                      <span style={{ color: C.ink, fontSize: 13 }}>{CHANNEL_TYPES[ch].label}</span>
                      <span style={{ color: on ? world.brand.color : C.faint, fontSize: 12, fontWeight: 600 }}>{on ? "✓ carrying" : "off"}</span>
                    </div>
                  );
                })}
                <div style={{ color: C.faint, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                  A product only sells through the channels you switch on. If your buyers shop online but you only stock dept stores, you'll underperform — check the Gap study.
                </div>
                <button style={{ ...ctrlBtn, marginTop: 8 }} onClick={openContract}>+ Negotiate another channel</button>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Licensing */}
      <div style={{ marginTop: 16 }}>
        <FieldLabel>Licensing — attach a brand license to this product</FieldLabel>
        <div style={{ color: C.faint, fontSize: 11, marginBottom: 8 }}>A license boosts the "licensed" and "collectible" appeal — huge for toys, modest for skincare. Costs an annual fee + per-unit royalty.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6, maxHeight: 260, overflowY: "auto" }}>
          <button onClick={() => setLicense(skuIndex, null)}
            style={{ textAlign: "left", background: !sku.license ? C.panel2 : C.bg, border: `1px solid ${!sku.license ? world.brand.color : C.line}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: C.ink }}>
            <div style={{ fontWeight: 600, fontSize: 12 }}>No license</div>
            <div style={{ color: C.dim, fontSize: 10 }}>Save on royalties</div>
          </button>
          {LICENSES.map((lic) => {
            const on = sku.license === lic.key;
            const cm = lic.categoryMult[world.cfg.id] ?? 1;
            return (
              <button key={lic.key} onClick={() => setLicense(skuIndex, lic.key)}
                style={{ textAlign: "left", background: on ? C.panel2 : C.bg, border: `1px solid ${on ? world.brand.color : C.line}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: C.ink }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{lic.label}</div>
                <div style={{ color: C.dim, fontSize: 10 }}>{lic.tier} · {fmtMoney(lic.annualFee)}/yr + ${lic.unitRoyalty.toFixed(2)}/unit</div>
                <div style={{ color: cm > 1 ? C.green : cm < 0.5 ? C.red : C.dim, fontSize: 10 }}>
                  {cm > 1.3 ? "strong fit" : cm > 0.8 ? "moderate fit" : "weak fit"} for {world.cfg.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <button style={{ ...bigBtn, width: "100%", marginTop: 16 }} onClick={onClose}>Done</button>
    </Modal>
  );
}

export function ContractModal({ world, onSign, onClose }: { world: World; onSign: (partnerId: string) => void; onClose: () => void }) {
  const available = RETAIL_PARTNERS.filter((p) => {
    if (p.industries && !p.industries.includes(world.cfg.id)) return false;
    if (world.player.contracts.some((c) => c.partnerId === p.id)) return false;
    return true;
  });
  const signed = world.player.contracts;
  return (
    <Modal onClose={onClose} title="Distribution Partners" wide>
      {signed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>Active contracts</div>
          {signed.map((c, i) => (
            <div key={i} style={{ fontSize: 12, padding: "4px 0", color: C.ink }}>{c.partnerName || c.type} — {(c.marginCut * 100).toFixed(0)}% cut</div>
          ))}
        </div>
      )}
      <div style={{ color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>Available partners</div>
      {available.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>All available partners signed or none match your industry.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, maxHeight: 400, overflowY: "auto" }}>
        {available.map((p) => (
          <div key={p.id} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{p.name}</div>
            <div style={{ color: C.dim, fontSize: 11, marginTop: 2, marginBottom: 6 }}>{p.desc}</div>
            <div style={{ fontSize: 11, color: C.faint, display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <span>Cut: <span style={{ color: C.amber }}>{(p.marginCut * 100).toFixed(0)}%</span></span>
              <span>Slotting: <span style={{ color: C.amber }}>{fmtMoney(p.slotting)}/Q</span></span>
              <span>Pays in: <span style={{ color: p.paymentDays > 60 ? C.red : C.cyan }}>{p.paymentDays}d</span></span>
              <span>Reach: <span style={{ color: C.cyan }}>{(p.reachMult * 100).toFixed(0)}%</span></span>
            </div>
            <button style={{ ...bigBtn, width: "100%", fontSize: 12 }} onClick={() => onSign(p.id)}>Sign with {p.name}</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <button style={ctrlBtn} onClick={onClose}>Done</button>
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
