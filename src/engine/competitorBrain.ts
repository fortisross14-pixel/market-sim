// ============================================================================
// Milestone 2 — Competitor AI.
// Each competitor runs a quarterly decision that reads live per-cell state and
// picks the highest-priority action its personality and cash allow.
// Actions: invade a niche, defend a segment, escalate marketing, exit a segment.
// Every meaningful move is pushed as a MarketEvent so the player sees the market react.
// ============================================================================
import type { World, Competitor, Cell, AxisKey, CompetitorProduct } from "./types";
import { TICKS_PER_QUARTER, TICK_RATE_SCALE } from "./types";
import { AXES, AXIS_KEYS, axisPos, clamp, ease, sum } from "./industries";
import { fit, effectiveTarget, needMatch } from "./cube";

const REF_PRICE = 45;
const coordKey = (c: Cell) => `${c.coord.gender}|${c.coord.age}|${c.coord.class}|${c.coord.leaning}`;

function playerTargets(w: World) {
  return w.player.skus.map((s) => {
    const pt = w.cfg.products.find((p) => p.key === s.productKey);
    return effectiveTarget(s.target, pt);
  });
}

function appealOf(target: Record<AxisKey, number>, attributes: Record<string, number>, quality: number, price: number, priceSens: number, awareness: number, cell: Cell, cfg: World["cfg"]) {
  const f = fit(target, cell, cfg);
  const nm = needMatch(attributes, cell, cfg);
  const priceTerm = 1 - clamp(price / REF_PRICE - 1, -0.6, 0.9) * priceSens * 0.5;
  const qTerm = 0.5 + 0.5 * quality;
  return Math.max(0, f * nm * qTerm * priceTerm) * awareness;
}

interface CellAssessment {
  cell: Cell; market: number; playerShare: number; myShare: number; myBestFit: number;
}

function assessCells(w: World, comp: Competitor): CellAssessment[] {
  const pts = playerTargets(w);
  const out: CellAssessment[] = [];
  for (const cell of w.cube) {
    const market = cell.head * cell.spend;
    if (market <= 0) continue;
    const playerEff = w.player.skus.map((s, i) =>
      appealOf(pts[i], s.attributes, s.quality, s.listPrice, s.priceSens, (cell.awareness[s.id] ?? 0) * 0.7, cell, w.cfg));
    const allCompEff: number[] = [];
    let myEff = 0, myBestFit = 0;
    for (const c of w.comps) {
      for (const cp of c.products) {
        const e = appealOf(cp.target, cp.attributes, cp.quality, cp.price, cp.priceSens, cell.awareness[cp.awarenessKey] ?? 0, cell, w.cfg);
        allCompEff.push(e);
        if (c.id === comp.id) { myEff += e; myBestFit = Math.max(myBestFit, fit(cp.target, cell, w.cfg)); }
      }
    }
    const denom = sum(playerEff) + sum(allCompEff) || 1;
    out.push({ cell, market, playerShare: sum(playerEff) / denom, myShare: myEff / denom, myBestFit });
  }
  return out;
}

function cellCoordTarget(cell: Cell): Record<AxisKey, number> {
  const t = {} as Record<AxisKey, number>;
  for (const axis of AXIS_KEYS) t[axis] = axisPos(axis, AXES[axis].indexOf(cell.coord[axis]));
  return t;
}

function decide(w: World, comp: Competitor) {
  const assess = assessCells(w, comp);
  const coordK = (a: CellAssessment) => coordKey(a.cell);

  // update threat memory: count consecutive quarters the player has dominated each cell
  for (const a of assess) {
    const k = coordK(a);
    if (a.playerShare > 0.30 && a.market > 800_000) comp.threatMemory[k] = (comp.threatMemory[k] || 0) + 1;
    else comp.threatMemory[k] = 0;
  }

  if (comp.actionCooldown > 0) { comp.actionCooldown -= 1; comp.lastAction = "hold"; return; }

  const byPlayerThreat = [...assess].sort((a, b) => (b.playerShare * b.market) - (a.playerShare * a.market));
  const topPlayerCell = byPlayerThreat[0];
  const aggressiveness = comp.personality === "discounter" ? 1 : comp.personality === "premium" ? 0.6 : 0.8;

  // 1) INVASION — only after the player has HELD the cell for ~4 quarters (a year)
  if (topPlayerCell && comp.threatMemory[coordK(topPlayerCell)] >= 4
      && topPlayerCell.playerShare > 0.35 && topPlayerCell.myBestFit < 0.4
      && topPlayerCell.market > 1_000_000 && comp.products.length < 3 && comp.cash > 400_000) {
    const cell = topPlayerCell.cell;
    const downmarket = cell.coord.class === "Budget";
    if (!(comp.personality === "premium" && downmarket)) {
      const target = cellCoordTarget(cell);
      // build attributes that mirror the cell's top need preferences — a real threat
      const attrs: Record<string, number> = {};
      const prefs = Object.entries(cell.needPref).sort((a, b) => b[1] - a[1]);
      w.cfg.needs.forEach((n) => { attrs[n.key] = 0.2; });
      prefs.slice(0, 2).forEach(([k]) => { attrs[k] = 0.85; });
      const np: CompetitorProduct = {
        target,
        quality: clamp(comp.quality + (Math.random() * 0.1 - 0.05)),
        price: comp.basePrice * (comp.personality === "discounter" ? 0.9 : 1.0),
        basePrice: comp.basePrice,
        priceSens: comp.priceSens,
        awarenessKey: `${comp.id}_p${comp.products.length}`,
        attributes: attrs,
        productKey: comp.products[0]?.productKey ?? w.cfg.products[0].key,
      };
      for (const c of w.cube) c.awareness[np.awarenessKey] = 0.05;
      comp.products.push(np);
      comp.cash -= 400_000;
      comp.lastAction = "invade";
      comp.actionCooldown = 24 * 2; // ~2 years before another big move
      w.events.push({ tick: w.tick, kind: "rival",
        text: `🎯 ${comp.name} launched a product targeting your stronghold (${cell.coord.age} · ${cell.coord.class}).` });
      return;
    }
  }

  // 2) DEFENSE — escalate marketing where contested; cooldown prevents spam
  const myLeads = assess.filter((a) => a.myShare > 0.25 && a.playerShare > 0.15 && a.market > 800_000).sort((a, b) => b.market - a.market);
  if (myLeads.length && comp.cash > 150_000 && Math.random() < aggressiveness) {
    const cell = myLeads[0].cell;
    comp.marketingFocus = cell.coord.age;
    comp.marketing = clamp(comp.marketing * 1.15, 50_000, 400_000);
    comp.cash -= 80_000;
    comp.lastAction = "defend";
    comp.actionCooldown = 24; // once a year at most
    w.events.push({ tick: w.tick, kind: "rival",
      text: `🛡 ${comp.name} is defending ${cell.coord.age} buyers — ramping marketing.` });
    return;
  }

  // 3) EXIT — abandon a small cell lost badly
  const losing = assess.filter((a) => a.myShare < 0.05 && a.playerShare > 0.4 && a.market < 700_000);
  if (losing.length && comp.products.length > 1) {
    const cell = losing.sort((a, b) => a.market - b.market)[0].cell;
    const key = coordKey(cell);
    if (!comp.exitedCells.includes(key)) {
      comp.exitedCells.push(key);
      comp.lastAction = "exit";
      comp.actionCooldown = 24;
      w.events.push({ tick: w.tick, kind: "rival",
        text: `🏳 ${comp.name} is pulling back from ${cell.coord.age} · ${cell.coord.class} — a gap may open.` });
      return;
    }
  }

  comp.lastAction = "hold";
}

function updateCompetitorPrices(w: World, comp: Competitor) {
  const playerAvg = w.player.skus.length ? sum(w.player.skus.map((s) => s.listPrice)) / w.player.skus.length : REF_PRICE;
  for (const cp of comp.products) {
    if (comp.personality === "discounter") {
      const target = Math.max(cp.basePrice * 0.7, Math.min(cp.basePrice, playerAvg * 0.92));
      cp.price = ease(cp.price, target, 0.5);
    } else if (comp.personality === "premium") {
      const target = clamp(Math.max(cp.basePrice, playerAvg * 1.1), cp.basePrice * 0.85, cp.basePrice * 1.4);
      cp.price = ease(cp.price, target, 0.3);
    } else {
      cp.price = ease(cp.price, cp.basePrice, 0.25);
    }
  }
  comp.price = comp.products[0]?.price ?? comp.price;
}

export function competitorAwareness(w: World, comp: Competitor, cell: Cell) {
  const focusMatch = (comp.marketingFocus === "all" || cell.coord.age === comp.marketingFocus) ? 1 : 0.5;
  const power = clamp((comp.marketing - 40_000) / 400_000, 0, 1.2);
  for (const cp of comp.products) {
    if (comp.exitedCells.includes(coordKey(cell))) {
      cell.awareness[cp.awarenessKey] = ease(cell.awareness[cp.awarenessKey] ?? 0, 0, 0.02 * TICK_RATE_SCALE);
      continue;
    }
    const f = fit(cp.target, cell, w.cfg);
    const push = clamp(f * (0.5 + 0.5 * comp.strength));
    const speed = clamp(0.008 * TICK_RATE_SCALE * (0.5 + power * focusMatch));
    const cur = cell.awareness[cp.awarenessKey] ?? 0;
    cell.awareness[cp.awarenessKey] = clamp(cur + (push - cur) * speed);
  }
}

export function runCompetitorBrains(w: World) {
  if (w.tick % TICKS_PER_QUARTER === 0) {
    for (const comp of w.comps) {
      comp.cash += 250_000;
      updateCompetitorPrices(w, comp);
      decide(w, comp);
    }
  }
}
