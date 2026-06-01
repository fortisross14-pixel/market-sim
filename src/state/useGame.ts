import { useRef, useState, useEffect, useCallback } from "react";
import type { World, Brand, ChannelType, Coord } from "../engine/types";
import { initWorld, buildSku, STUDY_DEFS, type ProductSpec } from "../engine/world";
import { step } from "../engine/tick";
import { launchInheritance } from "../engine/brandEquity";

export function useGame() {
  const worldRef = useRef<World | null>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((x) => x + 1), []);
  const [phase, setPhase] = useState<"home" | "setup" | "play">("home");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [modal, setModal] = useState<null | "creator" | "contract" | "distribution">(null);
  const [distSku, setDistSku] = useState(0);

  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (t: number) => {
      const dt = t - last; last = t;
      const paused = !playing || modal !== null;
      if (!paused && worldRef.current) {
        acc += dt * speed;
        while (acc >= 140) { step(worldRef.current); acc -= 140; }
        rerender();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, playing, speed, modal, rerender]);

  const launch = useCallback((industryId: string, company: string, brand: Brand, startCash: number) => {
    worldRef.current = initWorld(industryId, company, brand, startCash);
    setPhase("play"); setModal("creator"); rerender();
  }, [rerender]);

  const createProduct = useCallback((spec: ProductSpec) => {
    const w = worldRef.current!; const id = "P" + w.player.skus.length;
    const sku = buildSku(w.cfg, spec, id);
    // a new product ships through whatever channels the company has already contracted
    sku.channels = Array.from(new Set(w.player.contracts.map((c) => c.type)));
    w.player.cash -= spec.batch * sku.unitCost;
    // launch inheritance: a new SKU starts with credibility where the brand is already strong
    for (let ci = 0; ci < w.cube.length; ci++) {
      const inherit = launchInheritance(w, ci);
      if (inherit > 0.01) w.cube[ci].awareness[id] = inherit;
    }
    w.player.skus.push(sku); w.fitCacheDirty = true; setModal(null); rerender();
  }, [rerender]);

  const produce = useCallback((si: number, qty: number) => {
    const w = worldRef.current!; const s = w.player.skus[si]; const cost = qty * s.unitCost;
    if (cost > w.player.cash) return;
    w.player.cash -= cost; s.inventory += qty; rerender();
  }, [rerender]);

  // per-product distribution & packaging
  const setPackaging = useCallback((si: number, pkg: string) => {
    const w = worldRef.current!; w.player.skus[si].packaging = pkg; w.fitCacheDirty = true; rerender();
  }, [rerender]);
  const setProductPrice = useCallback((si: number, price: number) => {
    const w = worldRef.current!; w.player.skus[si].listPrice = price; rerender();
  }, [rerender]);
  const toggleProductChannel = useCallback((si: number, type: ChannelType) => {
    const w = worldRef.current!; const s = w.player.skus[si];
    s.channels = s.channels.includes(type) ? s.channels.filter((c) => c !== type) : [...s.channels, type];
    w.fitCacheDirty = true; rerender();
  }, [rerender]);

  const signContract = useCallback((type: ChannelType, marginCut: number) => {
    const w = worldRef.current!;
    w.player.contracts.push({ type, marginCut });
    // newly available channel: products with no channels yet pick it up; existing keep their choices
    for (const s of w.player.skus) if (s.channels.length === 0) s.channels = [type];
    w.fitCacheDirty = true; setModal(null); rerender();
  }, [rerender]);
  const removeContract = useCallback((i: number) => {
    const w = worldRef.current!;
    const removed = w.player.contracts[i];
    w.player.contracts.splice(i, 1);
    // drop that channel from any product using it
    if (removed) for (const s of w.player.skus) s.channels = s.channels.filter((c) => c !== removed.type);
    w.fitCacheDirty = true; rerender();
  }, [rerender]);

  const setMarketing = useCallback((v: number) => { worldRef.current!.player.marketingTarget = v; rerender(); }, [rerender]);
  const setBrandMarketing = useCallback((v: number) => { worldRef.current!.player.brandMarketingTarget = v; rerender(); }, [rerender]);
  const setBackOffice = useCallback((v: number) => { worldRef.current!.player.backOfficeTarget = v; rerender(); }, [rerender]);
  const setFocus = useCallback((v: string) => { worldRef.current!.player.marketingFocus = v; rerender(); }, [rerender]);
  const saveSegment = useCallback((name: string, filter: Record<string, string[]>) => {
    const w = worldRef.current!;
    w.savedSegments.push({ id: "seg_" + Date.now(), name, filter });
    rerender();
  }, [rerender]);
  const deleteSegment = useCallback((id: string) => {
    const w = worldRef.current!;
    w.savedSegments = w.savedSegments.filter((s) => s.id !== id);
    if (w.player.marketingFocus === "seg:" + id) w.player.marketingFocus = "all";
    rerender();
  }, [rerender]);
  const selectCell = useCallback((coord: Coord) => { worldRef.current!.selectedCell = coord; rerender(); }, [rerender]);
  const borrow = useCallback((amount: number) => { const w = worldRef.current!; w.player.cash += amount; w.player.debt += amount; rerender(); }, [rerender]);
  const repay = useCallback((amount: number) => { const w = worldRef.current!; const a = Math.min(amount, w.player.debt, Math.max(0, w.player.cash)); w.player.cash -= a; w.player.debt -= a; rerender(); }, [rerender]);

  const commission = useCallback((type: string) => {
    const w = worldRef.current!;
    if (w.studies.find((s) => s.type === type && !s.done)) return;
    w.player.cash -= STUDY_DEFS[type].cost;
    w.studies = w.studies.filter((s) => s.type !== type);
    w.studies.push({ type, ticksLeft: STUDY_DEFS[type].ticks, done: false });
    rerender();
  }, [rerender]);

  return {
    world: worldRef.current, phase, setPhase, playing, setPlaying, speed, setSpeed, modal, setModal,
    distSku, openDistribution: (si: number) => { setDistSku(si); setModal("distribution"); },
    launch, createProduct, produce, signContract, removeContract,
    setPackaging, setProductPrice, toggleProductChannel,
    setMarketing, setBrandMarketing, setBackOffice, setFocus, selectCell, commission, borrow, repay,
    saveSegment, deleteSegment,
  };
}
