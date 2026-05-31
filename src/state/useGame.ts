import { useRef, useState, useEffect, useCallback } from "react";
import type { World, Brand, ChannelType, Coord } from "../engine/types";
import { initWorld, buildSku, STUDY_DEFS, type ProductSpec } from "../engine/world";
import { step } from "../engine/tick";

export function useGame() {
  const worldRef = useRef<World | null>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((x) => x + 1), []);
  const [phase, setPhase] = useState<"home" | "setup" | "play">("home");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [modal, setModal] = useState<null | "creator" | "contract">(null);

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
    w.player.cash -= spec.batch * sku.unitCost;
    w.player.skus.push(sku); setModal(null); rerender();
  }, [rerender]);

  const produce = useCallback((si: number, qty: number) => {
    const w = worldRef.current!; const s = w.player.skus[si]; const cost = qty * s.unitCost;
    if (cost > w.player.cash) return;
    w.player.cash -= cost; s.inventory += qty; rerender();
  }, [rerender]);

  const signContract = useCallback((type: ChannelType, marginCut: number) => {
    worldRef.current!.player.contracts.push({ type, marginCut }); setModal(null); rerender();
  }, [rerender]);
  const removeContract = useCallback((i: number) => {
    worldRef.current!.player.contracts.splice(i, 1); rerender();
  }, [rerender]);

  const setMarketing = useCallback((v: number) => { worldRef.current!.player.marketingTarget = v; rerender(); }, [rerender]);
  const setBackOffice = useCallback((v: number) => { worldRef.current!.player.backOfficeTarget = v; rerender(); }, [rerender]);
  const setFocus = useCallback((v: string) => { worldRef.current!.player.marketingFocus = v; rerender(); }, [rerender]);
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
    launch, createProduct, produce, signContract, removeContract,
    setMarketing, setBackOffice, setFocus, selectCell, commission, borrow, repay,
  };
}
