import type {
  World, Cell, SKU, Competitor, CellFinance, IncomeStatement, CashFlow, SkuResult,
} from "./types";
import { TICKS_PER_QUARTER } from "./types";
import { AXES, AXIS_KEYS, axisPos, clamp, ease, sum, CHANNEL_TYPES } from "./industries";
import { fit, effectiveTarget, applyDriftAndShocks, needMatch, effectiveAttributes, packagingResonance, channelFit } from "./cube";
import { contractReach } from "./economics";
import { runCompetitorBrains, competitorAwareness } from "./competitorBrain";
import { cellsInSegment } from "./segments";
import { earnedSignals, updateEquity, equityDemandMult, pricingPower, trustAwarenessLift } from "./brandEquity";
import { satisfactionTarget, updateCustomers } from "./customers";

const REF_PRICE = 45;
const cellKey = (c: { coord: { gender: string; age: string; class: string; leaning: string; geography: string; family: string } }) =>
  `${c.coord.gender}|${c.coord.age}|${c.coord.class}|${c.coord.leaning}|${c.coord.geography}|${c.coord.family}`;

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
  w.player.brandMarketing = ease(w.player.brandMarketing, w.player.brandMarketingTarget, 0.08);
  w.player.backOffice = ease(w.player.backOffice, w.player.backOfficeTarget, 0.08);

  const contracts = w.player.contracts;
  const totalReach = contracts.length ? clamp(sum(contracts.map(contractReach)) / 1.5) : 0;
  const onlineCoverage = contracts.length
    ? clamp(sum(contracts.map((c) => contractReach(c) * CHANNEL_TYPES[c.type].online)))
    : 0;
  const awarenessBoost = sum(contracts.map((c) => CHANNEL_TYPES[c.type].awarenessBoost * contractReach(c)));
  const marketingPower = clamp((w.player.marketing - 40000) / 400000, 0, 1.2);
  const brandPower = clamp((w.player.brandMarketing) / 300000, 0, 1.2);
  const equitySignals = earnedSignals(w);

  const playerTargets = w.player.skus.map((s) => skuEffectiveTarget(w, s));

  // resolve marketing focus: "all", an age band, or "seg:<id>" (a saved segment)
  const focusSeg = w.player.marketingFocus.startsWith("seg:")
    ? w.savedSegments.find((s) => s.id === w.player.marketingFocus.slice(4))
    : null;
  const focusCellKeys = focusSeg ? new Set(cellsInSegment(w, focusSeg.filter).map((c) => cellKey(c))) : null;
  // concentration boost: a narrower focus (fewer cells targeted) lifts the awareness ceiling more.
  // ranges ~1 (broad, half the cube) to ~2.2 (very narrow, a handful of cells).
  const concentrationBoost = focusCellKeys
    ? clamp(1 + (1 - focusCellKeys.size / w.cube.length) * 1.5, 1, 2.4)
    : 1;

  // refresh static-fit cache if products/segments changed (cheap: only on edits, not per tick)
  if (w.fitCacheDirty) {
    w.fitCache = {};
    for (const p of w.player.skus) {
      const arr = new Array(w.cube.length);
      const tgt = skuEffectiveTarget(w, p);
      const effAttrs = effectiveAttributes(cfg.id, p.packaging, p.attributes);
      for (let ci = 0; ci < w.cube.length; ci++) {
        const cell = w.cube[ci];
        const cat = cell.categoryPref[p.productKey] ?? 0.5;
        const pkg = packagingResonance(p.packaging, cell);
        const chFit = channelFit(p.channels, cell);
        arr[ci] = fit(tgt, cell, cfg) * needMatch(effAttrs, cell, cfg) * cat * pkg * chFit;
      }
      w.fitCache[p.id] = arr;
    }
    w.fitCacheDirty = false;
  }

  // per-cell finance accumulators
  const cellFinance: CellFinance[] = [];
  // per-sku quarterly accumulators (annual run-rate in $ and units demanded)
  const skuRevAnnual = w.player.skus.map(() => 0);
  const skuUnitsAnnual = w.player.skus.map(() => 0);
  // for marketing allocation by cell: track awareness-weighted exposure
  const skuCellRev: number[][] = w.player.skus.map(() => []);

  for (let ci = 0; ci < w.cube.length; ci++) {
    const cell = w.cube[ci];
    const cellMarket = cell.head * cell.spend;

    // dormancy: if no player product has meaningful static fit here AND player has no awareness yet, skip.
    // (Competitors still hold this cell among themselves, but it doesn't affect the player's P&L.)
    let maxStatic = 0;
    for (const p of w.player.skus) { const s = w.fitCache[p.id]?.[ci] ?? 0; if (s > maxStatic) maxStatic = s; }
    const isSelected = w.selectedCell &&
      cell.coord.gender === w.selectedCell.gender && cell.coord.age === w.selectedCell.age &&
      cell.coord.class === w.selectedCell.class && cell.coord.leaning === w.selectedCell.leaning &&
      cell.coord.geography === w.selectedCell.geography && cell.coord.family === w.selectedCell.family;
    const hasCustomers = (w.customers[ci]?.count ?? 0) > 1;
    if (maxStatic < 0.02 && !isSelected && !hasCustomers) continue; // dormant — no fit, no base, not selected

    // brand equity: update it here (this is a cell we're active in), then read its effects.
    const brandFocusMatch = focusCellKeys
      ? (focusCellKeys.has(cellKey(cell)) ? 1.2 : 0.15)
      : (w.player.marketingFocus === "all" || cell.coord.age === w.player.marketingFocus) ? 1 : 0.5;
    updateEquity(w, ci, brandPower, brandFocusMatch, equitySignals);
    const eqDemand = equityDemandMult(w, ci, cell); // demand shift
    const eqPricePower = pricingPower(w, ci);       // softens price penalty
    const eqAwareLift = trustAwarenessLift(w, ci);  // raises awareness ceiling

    // update player awareness (ramp from 0), ceiling tied to fit & distribution presence
    for (let i = 0; i < w.player.skus.length; i++) {
      const p = w.player.skus[i];
      const fStatic = w.fitCache[p.id]?.[ci] ?? 0;
      const onlineFit = 0.5 + 0.5 * p.online;
      const focusMatch = focusCellKeys
        ? (focusCellKeys.has(cellKey(cell)) ? 1.2 : 0.15)
        : (w.player.marketingFocus === "all" || cell.coord.age === w.player.marketingFocus) ? 1 : 0.3;
      const distPresence = totalReach * 0.6 + onlineCoverage * onlineFit * 0.4;
      // concentration: narrower focus (fewer cells) pushes a higher ceiling per targeted cell.
      const focusLift = 1 + marketingPower * (focusMatch - 1) * 0.6 * concentrationBoost;
      const push = clamp(fStatic * (0.35 + 0.65 * distPresence) * Math.max(0.2, focusLift) * eqAwareLift);
      const speed = clamp(0.010 * (0.3 + marketingPower * focusMatch + 0.6 * awarenessBoost));
      const cur = cell.awareness[p.id] || 0;
      cell.awareness[p.id] = clamp(cur + (push - cur) * speed);
    }

    // update competitor awareness (their marketing builds it, focused, with exit-decay)
    for (const comp of w.comps) competitorAwareness(w, comp, cell);

    // effective appeal. Static factor (fit×need×category) is cached; price & quality-sensitivity are live.
    const playerEff = w.player.skus.map((p, i) => {
      const fStatic = w.fitCache[p.id]?.[ci] ?? 0;
      // prestige softens the price penalty (pricing power): a premium brand is forgiven a high price.
      const effPriceSens = cell.priceSens * (1 - eqPricePower);
      const priceTerm = 1 - clamp(p.listPrice / REF_PRICE - 1, -0.6, 0.9) * effPriceSens * 0.5;
      const qTerm = 1 - cell.qualitySens + cell.qualitySens * p.quality;
      const aware = (cell.awareness[p.id] ?? 0) * (0.4 + 0.6 * totalReach);
      return Math.max(0, fStatic * qTerm * priceTerm * eqDemand) * aware;
    });
    // each competitor's appeal = sum over their products
    const compEff = w.comps.map((c) => {
      let e = 0;
      for (const cp of c.products) {
        const f = fit(cp.target, cell, cfg);
        const nm = needMatch(cp.attributes, cell, cfg);
        const cat = cell.categoryPref[cp.productKey ?? ""] ?? 0.6;
        const priceTerm = 1 - clamp(cp.price / REF_PRICE - 1, -0.6, 0.9) * cell.priceSens * 0.5;
        const qTerm = 1 - cell.qualitySens + cell.qualitySens * cp.quality;
        const aware = cell.awareness[cp.awarenessKey] ?? 0;
        e += Math.max(0, f * nm * cat * qTerm * priceTerm) * aware;
      }
      return e;
    });
    const denom = sum(playerEff) + sum(compEff) || 1;

    // ---- customer base: acquire → retain → repeat (the primary revenue driver) ----
    const playerAppeal = sum(playerEff);
    const acquireShare = playerAppeal / denom;          // our pull vs the whole field
    const bestRival = compEff.length ? Math.max(...compEff) : 0;
    const trust = (w.brandEquity[ci]?.trust) ?? 0;
    // absolute experience: how good our products actually are for this segment (quality + price fairness),
    // weighted by our appeal mix. A bad/overpriced product dissatisfies even with no competitor present.
    let qualityValue = 0.5;
    if (playerAppeal > 0) {
      let acc = 0;
      w.player.skus.forEach((p, i) => {
        const wgt = playerEff[i] / playerAppeal;
        const qExp = 1 - cell.qualitySens + cell.qualitySens * p.quality;       // perceived quality
        const fair = clamp(1 - clamp(p.listPrice / REF_PRICE - 1, -0.5, 1.2) * cell.priceSens * 0.4, 0.1, 1.2); // price fairness
        acc += wgt * clamp(qExp * fair, 0, 1);
      });
      qualityValue = acc;
    }
    const satTarget = satisfactionTarget(playerAppeal, bestRival, trust, qualityValue);
    // revenue this tick from our retained+growing base in this cell
    const cellGrossFromBase = (playerAppeal > 0 || (w.customers[ci]?.count ?? 0) > 0)
      ? updateCustomers(w, ci, cell, acquireShare, satTarget, cell.spend)
      : 0;

    let cellRev = 0, cellUnits = 0, cellCogs = 0;
    // attribute the cell's customer revenue across our SKUs by their relative appeal here
    w.player.skus.forEach((p, i) => {
      const skuShareOfOurs = playerAppeal > 0 ? playerEff[i] / playerAppeal : (i === 0 ? 1 : 0);
      const grossRev = cellGrossFromBase * skuShareOfOurs;
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
    if (isSelected) {
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
  const brandMarketing = w.player.brandMarketing;
  const backOffice = w.player.backOffice;
  const ebitda = contribution - marketing - brandMarketing - slotting - backOffice;
  const interest = w.player.debt * 0.10 / 4; // 10% annual, per quarter
  const profit = ebitda - interest;

  const income: IncomeStatement = {
    grossRevenue, channelCut, netRevenue, cogs, contribution,
    marketing, brandMarketing, slotting, backOffice, ebitda, interest, profit,
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
  const opexTick = (marketing + brandMarketing + slotting + backOffice + interest) / TICKS_PER_QUARTER;
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
    const all = [
      ...w.player.skus.map((s) => ({ tgt: skuEffectiveTarget(w, s), attrs: s.attributes })),
      ...w.comps.flatMap((c) => c.products.map((p) => ({ tgt: p.target, attrs: p.attributes }))),
    ];
    const gaps = w.cube.map((c) => {
      const best = all.length ? Math.max(...all.map((p) => fit(p.tgt, c, w.cfg) * needMatch(p.attrs, c, w.cfg))) : 0;
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
  if (type === "product_diagnosis") {
    // For each product, find the segment it's INTRINSICALLY for — using its raw need-attributes
    // and category/demographic fit, ignoring packaging distortion and channel. Then report whether
    // packaging or channel is holding it back in that segment (the fixable levers).
    const diagnoses = w.player.skus.map((s) => {
      const tgt = skuEffectiveTarget(w, s);
      let best: { cell: typeof w.cube[number]; potential: number } | null = null;
      for (const cell of w.cube) {
        const cat = cell.categoryPref[s.productKey] ?? 0.5;
        // intrinsic potential: raw attributes, no packaging bias, no channel — "who is this really for?"
        const potential = fit(tgt, cell, w.cfg) * needMatch(s.attributes, cell, w.cfg) * cat;
        if (!best || potential > best.potential) best = { cell, potential };
      }
      if (!best || best.potential < 0.15) {
        return { sku: s.name, verdict: "weak", message: `${s.name} doesn't strongly fit any segment — its attributes may be too generic.` };
      }
      const cell = best.cell;
      const chFit = channelFit(s.channels, cell);
      const pkgRes = packagingResonance(s.packaging, cell);
      const segLabel = `${cell.coord.age} ${cell.coord.gender}, ${cell.coord.class}, ${cell.coord.geography}, ${cell.coord.family}`;
      const issues: { what: string; score: number; fix: string }[] = [];
      if (s.channels.length === 0) issues.push({ what: "it isn't distributed anywhere", score: 0, fix: "assign a channel in Distribution / Sales" });
      else if (chFit < 0.55) {
        const wantCh = Object.entries(cell.channelPref).sort((a, b) => b[1] - a[1])[0][0];
        const chLabel = (CHANNEL_TYPES as any)[wantCh]?.label ?? wantCh;
        issues.push({ what: `you're selling it in the wrong place — this segment shops ${chLabel}`, score: chFit, fix: `add the ${chLabel} channel` });
      }
      if (pkgRes < 0.88) issues.push({ what: "the packaging doesn't resonate with them", score: pkgRes, fix: "try packaging that skews to their age and class" });
      const top = issues.sort((a, b) => a.score - b.score)[0];
      return {
        sku: s.name, segLabel,
        potential: best.potential, channelFit: chFit, packagingResonance: pkgRes,
        verdict: top ? "mismatch" : "healthy",
        message: top
          ? `${s.name} is a great fit for ${segLabel} — but ${top.what}. Fix: ${top.fix}.`
          : `${s.name} is well-matched to ${segLabel} on product, packaging, and channel.`,
      };
    });
    return { diagnoses };
  }
  return {};
}
