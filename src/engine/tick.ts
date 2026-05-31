import type {
  World, Cell, SKU, Competitor, CellFinance, IncomeStatement, CashFlow, SkuResult,
} from "./types";
import { TICKS_PER_QUARTER } from "./types";
import { AXES, AXIS_KEYS, axisPos, clamp, ease, sum, CHANNEL_TYPES } from "./industries";
import { fit, effectiveTarget, applyDriftAndShocks } from "./cube";
import { contractReach } from "./economics";
import { runCompetitorBrains, competitorAwareness } from "./competitorBrain";

const REF_PRICE = 45;

function skuEffectiveTarget(w: World, sku: SKU) {
  const pt = w.cfg.products.find((p) => p.key === sku.productKey);
  return effectiveTarget(sku.target, pt);
}

export function step(w: World): World {
  const cfg = w.cfg;
  w.tick += 1;

  applyDriftAndShocks(w);
  runCompetitorBrains(w);

  // ease player spend toward targets
  w.player.marketing = ease(w.player.marketing, w.player.marketingTarget, 0.08);
  w.player.backOffice = ease(w.player.backOffice, w.player.backOfficeTarget, 0.08);

  const contracts = w.player.contracts;
  const totalReach = contracts.length ? clamp(sum(contracts.map(contractReach)) / 1.5) : 0;
  const onlineCoverage = contracts.length
    ? clamp(sum(contracts.map((c) => contractReach(c) * CHANNEL_TYPES[c.type].online)))
    : 0;
  const awarenessBoost = sum(contracts.map((c) => CHANNEL_TYPES[c.type].awarenessBoost * contractReach(c)));
  const marketingPower = clamp((w.player.marketing - 40000) / 400000, 0, 1.2);

  const playerTargets = w.player.skus.map((s) => skuEffectiveTarget(w, s));

  // per-cell finance accumulators
  const cellFinance: CellFinance[] = [];
  // per-sku quarterly accumulators (annual run-rate in $ and units demanded)
  const skuRevAnnual = w.player.skus.map(() => 0);
  const skuUnitsAnnual = w.player.skus.map(() => 0);
  // for marketing allocation by cell: track awareness-weighted exposure
  const skuCellRev: number[][] = w.player.skus.map(() => []);

  for (const cell of w.cube) {
    const cellMarket = cell.head * cell.spend;

    // update player awareness (ramp from 0), ceiling tied to fit & distribution presence
    for (let i = 0; i < w.player.skus.length; i++) {
      const p = w.player.skus[i];
      const f = fit(playerTargets[i], cell, cfg);
      const onlineFit = 0.5 + 0.5 * p.online;
      const focusMatch = (w.player.marketingFocus === "all" || cell.coord.age === w.player.marketingFocus) ? 1 : 0.3;
      const distPresence = totalReach * 0.6 + onlineCoverage * onlineFit * 0.4;
      const push = clamp(f * (0.35 + 0.65 * distPresence));
      const speed = clamp(0.010 * (0.3 + marketingPower * focusMatch + 0.6 * awarenessBoost));
      const cur = cell.awareness[p.id] || 0;
      cell.awareness[p.id] = clamp(cur + (push - cur) * speed);
    }

    // update competitor awareness (their marketing builds it, focused, with exit-decay)
    for (const comp of w.comps) competitorAwareness(w, comp, cell);

    // effective appeal for everyone in this cell
    const playerEff = w.player.skus.map((p, i) => {
      const f = fit(playerTargets[i], cell, cfg);
      const priceTerm = 1 - clamp(p.listPrice / REF_PRICE - 1, -0.6, 0.9) * p.priceSens * 0.5;
      const qTerm = 0.5 + 0.5 * p.quality;
      const aware = (cell.awareness[p.id] ?? 0) * (0.4 + 0.6 * totalReach);
      return Math.max(0, f * qTerm * priceTerm) * aware;
    });
    // each competitor's appeal = sum over their products
    const compEff = w.comps.map((c) => {
      let e = 0;
      for (const cp of c.products) {
        const f = fit(cp.target, cell, cfg);
        const priceTerm = 1 - clamp(cp.price / REF_PRICE - 1, -0.6, 0.9) * cp.priceSens * 0.5;
        const qTerm = 0.5 + 0.5 * cp.quality;
        const aware = cell.awareness[cp.awarenessKey] ?? 0;
        e += Math.max(0, f * qTerm * priceTerm) * aware;
      }
      return e;
    });
    const denom = sum(playerEff) + sum(compEff) || 1;

    let cellRev = 0, cellUnits = 0, cellCogs = 0;
    w.player.skus.forEach((p, i) => {
      const grossRev = cellMarket * (playerEff[i] / denom); // gross $ in this cell at run-rate
      const units = grossRev / (p.listPrice || 1);
      skuRevAnnual[i] += grossRev;
      skuUnitsAnnual[i] += units;
      skuCellRev[i].push(grossRev);
      cellRev += grossRev;
      cellUnits += units;
      cellCogs += units * p.unitCost;
    });

    // record finance for this cell (net of channel cut applied later uniformly)
    if (cellRev > 0) {
      cellFinance.push({
        coord: cell.coord,
        revenue: cellRev,
        units: cellUnits,
        grossMargin: cellRev - cellCogs,
        marketingAllocated: 0, // filled after we know totals
        contribution: 0,
      });
    }

    // selected cell inspection
    if (w.selectedCell &&
        cell.coord.gender === w.selectedCell.gender && cell.coord.age === w.selectedCell.age &&
        cell.coord.class === w.selectedCell.class && cell.coord.leaning === w.selectedCell.leaning) {
      const all = [
        ...w.player.skus.map((p, i) => ({ name: p.name, isComp: false, share: playerEff[i] / denom })),
        ...w.comps.map((c, i) => ({ name: c.name, isComp: true, share: compEff[i] / denom })),
      ].filter((x) => x.share > 0.001).sort((a, b) => b.share - a.share);
      w.selectedInfo = { head: cell.head, spend: cell.spend, market: cellMarket, breakdown: all };
    }
  }

  // allocate marketing to cells proportional to revenue (CAC by cell)
  const totalCellRev = sum(cellFinance.map((c) => c.revenue)) || 1;
  for (const cf of cellFinance) {
    cf.marketingAllocated = w.player.marketing * (cf.revenue / totalCellRev);
    cf.contribution = cf.grossMargin - cf.marketingAllocated;
  }

  // ---- fulfil demand from inventory; build income statement ----
  const avgMarginCut = contracts.length
    ? sum(contracts.map((c) => c.marginCut * contractReach(c))) / (sum(contracts.map(contractReach)) || 1)
    : 0.3;
  const avgPaymentDays = contracts.length
    ? sum(contracts.map((c) => CHANNEL_TYPES[c.type].paymentDays * contractReach(c))) / (sum(contracts.map(contractReach)) || 1)
    : 30;

  let grossRevenue = 0, cogs = 0, totalUnits = 0, lostTick = 0;
  const skuResults: SkuResult[] = w.player.skus.map((sku, i) => {
    const demandTick = skuUnitsAnnual[i] / (TICKS_PER_QUARTER * 4);
    const sold = Math.min(demandTick, sku.inventory);
    sku.inventory = Math.max(0, sku.inventory - sold);
    lostTick += Math.max(0, demandTick - sold);
    const unitsQ = sold * TICKS_PER_QUARTER;
    const gross = unitsQ * sku.listPrice;
    const varc = unitsQ * sku.unitCost;
    grossRevenue += gross; cogs += varc; totalUnits += unitsQ;
    const net = gross * (1 - avgMarginCut);
    return { units: unitsQ, revenue: net, gross, margin: net - varc, inventory: sku.inventory };
  });
  w.player.lostSales += lostTick;

  const channelCut = grossRevenue * avgMarginCut;
  const netRevenue = grossRevenue - channelCut;
  const contribution = netRevenue - cogs;
  const slotting = sum(contracts.map((c) => CHANNEL_TYPES[c.type].slotting));
  const marketing = w.player.marketing;
  const backOffice = w.player.backOffice;
  const ebitda = contribution - marketing - slotting - backOffice;
  const interest = w.player.debt * 0.10 / 4; // 10% annual, per quarter
  const profit = ebitda - interest;

  const income: IncomeStatement = {
    grossRevenue, channelCut, netRevenue, cogs, contribution,
    marketing, slotting, backOffice, ebitda, interest, profit,
  };

  // ---- working capital / cash flow ----
  // net revenue this tick goes into receivables, paid out after avgPaymentDays
  const netThisTick = netRevenue / TICKS_PER_QUARTER;
  const daysPerTick = 365 / (TICKS_PER_QUARTER * 4);
  const dueInTicks = Math.max(0, Math.round(avgPaymentDays / daysPerTick));
  if (netThisTick > 0) w.player.receivables.push({ amount: netThisTick, dueTick: w.tick + dueInTicks });

  // collect matured receivables
  let collected = 0;
  w.player.receivables = w.player.receivables.filter((r) => {
    if (r.dueTick <= w.tick) { collected += r.amount; return false; }
    return true;
  });
  const receivablesOutstanding = sum(w.player.receivables.map((r) => r.amount));

  // costs paid out immediately this tick (COGS already paid when produced as inventory; here pay opex)
  const opexTick = (marketing + slotting + backOffice + interest) / TICKS_PER_QUARTER;
  // cash moves by collections minus opex (COGS was paid at production time)
  w.player.cash += collected - opexTick;

  const inventoryValue = sum(w.player.skus.map((s) => s.inventory * s.unitCost));
  // Days Inventory Outstanding: inventory value / quarterly COGS * 90, bounded.
  const dio = cogs > 0 ? clamp((inventoryValue / cogs) * 90, 0, 365) : 0;
  const dso = avgPaymentDays; // Days Sales Outstanding ~ channel payment terms
  const cashCycleDays = dio + dso;

  const cashflow: CashFlow = {
    cash: w.player.cash,
    inventoryValue,
    receivables: receivablesOutstanding,
    cashCycleDays,
    operatingCashFlow: (collected - opexTick) * TICKS_PER_QUARTER,
    debt: w.player.debt,
  };

  // ---- overall share & history ----
  const totalMarket = sum(w.cube.map((c) => c.head * c.spend));
  const overallShare = totalMarket ? grossRevenue / totalMarket : 0;

  for (const st of w.studies) {
    if (!st.done) { st.ticksLeft -= 1; if (st.ticksLeft <= 0) { st.done = true; w.revealed[st.type] = { ...computeStudyFact(w, st.type), asOfTick: w.tick }; } }
  }

  w.history.push({
    tick: w.tick, quarter: Math.floor(w.tick / TICKS_PER_QUARTER),
    revenue: netRevenue, profit, share: overallShare, cash: w.player.cash,
    operatingCashFlow: cashflow.operatingCashFlow,
  });
  if (w.history.length > 700) w.history.shift();

  w.live = {
    income, cashflow, cellFinance, skuResults, totalUnits, overallShare,
    totalMarket, totalReach, onlineCoverage, avgMarginCut,
  };
  return w;
}

// studies (kept here to avoid cycles; small)
export function computeStudyFact(w: World, type: string): any {
  if (type === "market_map") return { ok: true };
  if (type === "gap_analysis") {
    const all = [...w.player.skus.map((s) => skuEffectiveTarget(w, s)), ...w.comps.map((c) => c.target)];
    const gaps = w.cube.map((c) => {
      const best = Math.max(...all.map((t) => fit(t, c, w.cfg)));
      return { coord: c.coord, market: c.head * c.spend, bestFit: best, gap: c.head * c.spend * (1 - best) };
    }).sort((a, b) => b.gap - a.gap).slice(0, 6);
    return { gaps };
  }
  if (type === "competitor_benchmark") {
    return {
      rivals: w.comps.map((c) => ({ name: c.name, price: Math.round(c.price), personality: c.personality, margin: 0.55 })),
      you: w.player.skus.map((s) => ({ name: s.name, price: s.listPrice, unitCost: Math.round(s.unitCost * 10) / 10, margin: (s.listPrice - s.unitCost) / s.listPrice })),
    };
  }
  return {};
}
