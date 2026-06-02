import { useRef, useState, useEffect, useCallback } from "react";
import type { World, Brand, ChannelType, Coord } from "../engine/types";
import { LOCATION_DEFS, RARITY_DEFS, BASE_SALARIES } from "../engine/types";
import { RETAIL_PARTNERS, MARKETING_AGENCIES } from "../engine/industries";
import { initWorld, buildSku, STUDY_DEFS, type ProductSpec } from "../engine/world";
import { step } from "../engine/tick";
import { launchInheritance } from "../engine/brandEquity";
import { deriveUnitCost } from "../engine/economics";
import { canCreateProduct, warehouseCapacity } from "../engine/capacity";

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
    // ticks-per-second by speed setting: 1x = 1 day/sec, 2x = 4 days/sec, 3x = 7 days/sec (a week).
    const tps = (s: number) => (s <= 1 ? 1 : s === 2 ? 4 : 7);
    const loop = (t: number) => {
      const dt = t - last; last = t;
      const paused = !playing || modal !== null;
      if (!paused && worldRef.current) {
        const msPerTick = 1000 / tps(speed);
        acc += dt;
        let guard = 0;
        while (acc >= msPerTick && guard < 30) { step(worldRef.current); acc -= msPerTick; guard++; }
        rerender();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, playing, speed, modal, rerender]);

  const launch = useCallback((industryId: string, company: string, brand: Brand, startCash: number) => {
    worldRef.current = initWorld(industryId, company, brand, startCash);
    setPhase("play"); rerender();
  }, [rerender]);

  const createProduct = useCallback((spec: ProductSpec) => {
    const w = worldRef.current!;
    const check = canCreateProduct(w);
    if (!check.ok) return;
    const id = "P" + w.player.skus.length;
    // find best AVAILABLE PM (not locked to a designing product)
    const lockedPmIds = new Set(w.player.skus.filter((s) => s.status === "designing" && s.assignedPmId).map((s) => s.assignedPmId));
    const availablePms = w.player.personnel.filter((p) => p.role === "product_manager" && !lockedPmIds.has(p.id));
    const bestPm = availablePms.sort((a, b) => b.skill - a.skill)[0];
    if (!bestPm) return; // no available PM
    const expertise = Math.max(w.player.expertise.category[spec.productKey] ?? 0, w.player.expertise.industry[w.cfg.id] ?? 0);
    const sku = buildSku(w.cfg, { ...spec, pmSkill: bestPm.skill, pmId: bestPm.id, designDepth: spec.designDepth ?? "normal" }, id, w.tick, expertise);
    // product starts in "designing" state — no inventory, no channels, no cash spent yet
    w.player.skus.push(sku); w.fitCacheDirty = true; setModal(null); rerender();
  }, [rerender]);

  // Start manufacturing a designed product — costs cash, takes time
  const produce = useCallback((si: number, qty: number) => {
    const w = worldRef.current!; const s = w.player.skus[si];
    if (!s) return;
    if (s.status !== "designed" && s.status !== "active") return;
    // warehouse capacity check: active product lines must not exceed warehouse slots
    const whCap = warehouseCapacity(w);
    const activeLines = w.player.skus.filter((sk) => sk.status === "active" || sk.status === "manufacturing").length;
    if (s.status === "designed" && activeLines >= whCap) return; // no room for a new product line
    const cost = qty * s.unitCost;
    if (w.player.cash < cost) return;
    w.player.cash -= cost;
    s.mfgBatchSize = qty;
    // manufacturing time: ~1 day per 5k units, min 3 days, max 60
    s.mfgDaysLeft = Math.min(60, Math.max(3, Math.round(qty / 5000)));
    s.status = "manufacturing";
    // on first manufacture, apply launch inheritance (brand credibility)
    if (s.launchTick === 0) {
      for (let ci = 0; ci < w.cube.length; ci++) {
        const inherit = launchInheritance(w, ci, s.productKey);
        if (inherit > 0.01) w.cube[ci].awareness[s.id] = inherit;
      }
      // channels derived from assigned partners (player assigns in Distribution)
      // auto-assign all contracted partners for convenience on first manufacture
      s.assignedPartnerIds = w.player.contracts.map((c) => c.partnerId);
      s.channels = Array.from(new Set(w.player.contracts.map((c) => c.type)));
    }
    rerender();
  }, [rerender]);

  const assignPartner = useCallback((si: number, partnerId: string, assign: boolean) => {
    const w = worldRef.current!; const s = w.player.skus[si];
    if (!s) return;
    if (assign) {
      if (!s.assignedPartnerIds.includes(partnerId)) s.assignedPartnerIds.push(partnerId);
    } else {
      s.assignedPartnerIds = s.assignedPartnerIds.filter((id) => id !== partnerId);
    }
    // derive channels from assigned partners
    const partnerTypes = s.assignedPartnerIds.map((pid) => {
      const c = w.player.contracts.find((ct) => ct.partnerId === pid);
      return c?.type;
    }).filter(Boolean) as import("../engine/types").ChannelType[];
    s.channels = Array.from(new Set(partnerTypes));
    w.fitCacheDirty = true; rerender();
  }, [rerender]);

  // per-product distribution & packaging
  const setPackaging = useCallback((si: number, pkg: string) => {
    const w = worldRef.current!; w.player.skus[si].packaging = pkg; w.fitCacheDirty = true; rerender();
  }, [rerender]);
  const setProductPrice = useCallback((si: number, price: number) => {
    const w = worldRef.current!; w.player.skus[si].listPrice = price; rerender();
  }, [rerender]);
  // change quality for the NEXT batch. perceivedQuality is NOT snapped — it eases over time in the
  // tick, anchored by the existing customer base, so a popular product's reputation shifts slowly.
  const setProductQuality = useCallback((si: number, quality: number) => {
    const w = worldRef.current!; const s = w.player.skus[si];
    const pt = w.cfg.products.find((p) => p.key === s.productKey)!;
    s.quality = quality;
    // recompute unit cost from the new quality (materials+production approximated by quality)
    s.unitCost = deriveUnitCost(pt, s.method, quality, quality);
    rerender();
  }, [rerender]);
  const setLicense = useCallback((si: number, key: string | null) => {
    const w = worldRef.current!; w.player.skus[si].license = key; w.fitCacheDirty = true; rerender();
  }, [rerender]);
  const toggleProductChannel = useCallback((si: number, type: ChannelType) => {
    const w = worldRef.current!; const s = w.player.skus[si];
    s.channels = s.channels.includes(type) ? s.channels.filter((c) => c !== type) : [...s.channels, type];
    w.fitCacheDirty = true; rerender();
  }, [rerender]);

  const signContract = useCallback((partnerId: string) => {
    const w = worldRef.current!;
    const partner = RETAIL_PARTNERS.find((p) => p.id === partnerId);
    if (!partner) return;
    // don't sign with the same partner twice
    if (w.player.contracts.some((c) => c.partnerId === partnerId)) return;
    w.player.contracts.push({
      type: partner.channelType, marginCut: partner.marginCut,
      partnerId: partner.id, partnerName: partner.name,
      slotting: partner.slotting, paymentDays: partner.paymentDays,
    });
    for (const s of w.player.skus) if (s.channels.length === 0) s.channels = [partner.channelType];
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
  const rentLocation = useCallback((type: import("../engine/types").LocationType, tier: number) => {
    const w = worldRef.current!;
    const def = LOCATION_DEFS[type].tiers[tier];
    if (w.player.cash < def.setupCost) return;
    w.player.cash -= def.setupCost;
    w.player.locations.push({ id: type + "_" + Date.now(), type, tier, monthlyCost: def.monthlyCost });
    rerender();
  }, [rerender]);
  const upgradeLocation = useCallback((locId: string, newTier: number) => {
    const w = worldRef.current!;
    const loc = w.player.locations.find((l) => l.id === locId);
    if (!loc) return;
    const def = LOCATION_DEFS[loc.type].tiers[newTier];
    const upgradeCost = def.setupCost - LOCATION_DEFS[loc.type].tiers[loc.tier].setupCost;
    if (w.player.cash < upgradeCost) return;
    w.player.cash -= Math.max(0, upgradeCost);
    loc.tier = newTier; loc.monthlyCost = def.monthlyCost;
    rerender();
  }, [rerender]);
  const hirePersonnel = useCallback((role: import("../engine/types").PersonnelRole) => {
    const w = worldRef.current!;
    // random rarity weighted toward common early, better with expertise
    const exp = Math.max(w.player.expertise.industry[w.cfg.id] ?? 0, ...Object.values(w.player.expertise.category));
    const roll = Math.random() + exp * 0.08;
    const rarity: import("../engine/types").Rarity = roll > 0.95 ? "legendary" : roll > 0.82 ? "epic" : roll > 0.65 ? "rare" : roll > 0.40 ? "uncommon" : "common";
    const rd = RARITY_DEFS[rarity];
    const skill = rd.skillRange[0] + Math.random() * (rd.skillRange[1] - rd.skillRange[0]);
    const salary = Math.round(BASE_SALARIES[role] * rd.salaryMult);
    const names = ["Alex","Jordan","Casey","Morgan","Taylor","Riley","Avery","Quinn","Reese","Cameron","Jamie","Drew","Blake","Skyler","Rowan"];
    const name = names[Math.floor(Math.random() * names.length)] + " " + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + ".";
    w.player.personnel.push({ id: "p_" + Date.now(), name, role, rarity, salary, skill });
    rerender();
  }, [rerender]);
  const firePersonnel = useCallback((id: string) => {
    const w = worldRef.current!;
    w.player.personnel = w.player.personnel.filter((p) => p.id !== id);
    rerender();
  }, [rerender]);
  const setVision = useCallback((goal: import("../engine/types").VisionGoal, scope: string, audience: string, audienceLabel: string) => {
    const w = worldRef.current!;
    w.player.vision = { goal, scope, audience, audienceLabel, setTick: w.tick, quartersPassed: 0 };
    rerender();
  }, [rerender]);
  const setFinanceDept = useCallback((tier: 0 | 1 | 2 | 3) => { worldRef.current!.player.financeDept = tier; rerender(); }, [rerender]);
  const setIntelDept = useCallback((tier: 0 | 1 | 2 | 3) => { worldRef.current!.player.intelDept = tier; rerender(); }, [rerender]);
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
  const updateSegment = useCallback((id: string, name: string, filter: Record<string, string[]>) => {
    const w = worldRef.current!;
    const seg = w.savedSegments.find((s) => s.id === id);
    if (seg) { seg.name = name; seg.filter = filter; }
    rerender();
  }, [rerender]);
  const launchCampaign = useCallback((name: string, segmentId: string, agencyId: string, budget: number, days: number) => {
    const w = worldRef.current!;
    const agency = MARKETING_AGENCIES.find((a) => a.id === agencyId);
    if (!agency) return;
    const cost = budget * agency.baseCostMult;
    if (w.player.cash < cost) return;
    const rel = w.agencyRelationships[agencyId] ?? 0;
    const relBonus = 1 + rel * 0.05; // 5% better per past campaign
    w.activeCampaigns.push({
      id: "camp_" + Date.now(), name, segmentId, agencyId,
      budget: cost, daysRemaining: days, totalDays: days,
      effectivenessMult: agency.effectivenessMult * relBonus,
    });
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
    launch, createProduct, produce, signContract, removeContract, assignPartner,
    setPackaging, setProductPrice, setProductQuality, setLicense, toggleProductChannel,
    setMarketing, setBrandMarketing, setBackOffice, setFinanceDept, setIntelDept, setFocus, selectCell, commission, borrow, repay,
    saveSegment, deleteSegment, updateSegment, launchCampaign,
    rentLocation, upgradeLocation, hirePersonnel, firePersonnel, setVision,
  };
}
