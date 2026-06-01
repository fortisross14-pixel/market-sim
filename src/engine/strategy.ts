// ============================================================================
// Milestone 3 — Strategy Reports.
// Pure derivations over live engine state. These FRAME dilemmas; they don't
// prescribe answers. Everything here reads the world and computes; no mutation.
// ============================================================================
import type { World, Cell, SKU, AxisKey } from "./types";
import { AXES, AXIS_KEYS, axisPos, sum, clamp } from "./industries";
import { fit, effectiveTarget, needMatch } from "./cube";

const coordLabel = (c: { age: string; gender: string; class: string; leaning: string }) =>
  `${c.age} · ${c.gender} · ${c.class} · ${c.leaning}`;

function skuTarget(w: World, s: SKU) {
  const pt = w.cfg.products.find((p) => p.key === s.productKey);
  return effectiveTarget(s.target, pt);
}

// ---------------------------------------------------------------------------
// SWOT — each item carries a value so we can rank and explain.
// ---------------------------------------------------------------------------
export interface SwotItem { text: string; weight: number; }
export interface Swot { strengths: SwotItem[]; weaknesses: SwotItem[]; opportunities: SwotItem[]; threats: SwotItem[]; }

export function computeSwot(w: World): Swot {
  const live = w.live;
  const s: SwotItem[] = [], we: SwotItem[] = [], o: SwotItem[] = [], t: SwotItem[] = [];
  if (!live) return { strengths: s, weaknesses: we, opportunities: o, threats: t };

  // STRENGTHS: top contribution cells you own
  const winners = [...live.cellFinance].filter((c) => c.contribution > 0).sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  for (const c of winners) s.push({ text: `Strong, profitable position in ${coordLabel(c.coord)} (${money(c.contribution)}/Q contribution).`, weight: c.contribution });
  if (live.income.contribution > 0 && live.income.contribution / Math.max(1, live.income.netRevenue) > 0.35)
    s.push({ text: `Healthy contribution margin (${pct(live.income.contribution / live.income.netRevenue)}) — pricing and cost are well matched.`, weight: live.income.contribution });

  // WEAKNESSES: negative-contribution cells, cash cycle, stockouts
  const bleeders = [...live.cellFinance].filter((c) => c.contribution < 0).sort((a, b) => a.contribution - b.contribution).slice(0, 2);
  for (const c of bleeders) we.push({ text: `Serving ${coordLabel(c.coord)} at a loss (${money(c.contribution)}/Q) — marketing or channel cost exceeds margin here.`, weight: -c.contribution });
  if (live.cashflow.cashCycleDays > 150) we.push({ text: `Long cash conversion cycle (${Math.round(live.cashflow.cashCycleDays)} days) ties up working capital.`, weight: live.cashflow.cashCycleDays * 1000 });
  if (w.player.lostSales > 5000) we.push({ text: `Cumulative lost sales from stock-outs (${num(w.player.lostSales)} units) — production isn't keeping up with demand.`, weight: w.player.lostSales });
  if (w.player.cash < 0) we.push({ text: `Cash is negative (${money(w.player.cash)}) despite the P&L — a classic profit-vs-cash trap.`, weight: 1e9 });

  // OPPORTUNITIES: unserved high-value cells — combined demographic AND need fit
  const allProducts = [
    ...w.player.skus.map((sk) => ({ tgt: skuTarget(w, sk), attrs: sk.attributes })),
    ...w.comps.flatMap((c) => c.products.map((p) => ({ tgt: p.target, attrs: p.attributes }))),
  ];
  const gaps = w.cube.map((cell) => {
    const best = allProducts.length ? Math.max(...allProducts.map((p) => fit(p.tgt, cell, w.cfg) * needMatch(p.attrs, cell, w.cfg))) : 0;
    return { cell, market: cell.head * cell.spend, best };
  }).filter((g) => g.best < 0.35 && g.market > 1_200_000).sort((a, b) => b.market - a.market).slice(0, 3);
  for (const g of gaps) o.push({ text: `Underserved: ${coordLabel(g.cell.coord)} (${money(g.market)} market — weak fit on demographics or needs).`, weight: g.market });

  // a growing segment is an opportunity
  const growing = w.cube.filter((c) => (c.head - c.baseHead) / c.baseHead > 0.02);
  if (growing.length) {
    const top = growing.sort((a, b) => (b.head * b.spend) - (a.head * a.spend))[0];
    o.push({ text: `${top.coord.age} cohort is growing — demand tailwind if you're positioned there.`, weight: top.head * top.spend });
  }

  // THREATS: rival invasions, shocks, contested strongholds
  const recentRival = w.events.filter((e) => e.kind === "rival" && e.tick > w.tick - 24 * 3);
  for (const e of recentRival.slice(-2)) t.push({ text: e.text.replace(/^[^ ]+ /, ""), weight: 1e6 });
  if (w.shock) t.push({ text: w.shock.type === "natality" ? "Natality crash is shrinking the youngest cohort — bets there will erode." : `Cultural drift toward ${w.shock.dir} is reshaping demand.`, weight: 5e6 });
  if (live.avgMarginCut > 0.38) t.push({ text: `High channel dependence — retailers take ${pct(live.avgMarginCut)} of gross. Buyer power is squeezing you.`, weight: live.avgMarginCut * 1e6 });

  const sortW = (arr: SwotItem[]) => arr.sort((a, b) => b.weight - a.weight).slice(0, 4);
  return { strengths: sortW(s), weaknesses: sortW(we), opportunities: sortW(o), threats: sortW(t) };
}

// ---------------------------------------------------------------------------
// Porter's Five Forces — each scored 0..1 (higher = more pressure on you).
// ---------------------------------------------------------------------------
export interface Force { name: string; pressure: number; note: string; }

export function computePorter(w: World): Force[] {
  const live = w.live;
  if (!live) return [];
  // Buyer power: channel cut + concentration (few contracts = more dependence)
  const buyer = clamp(live.avgMarginCut * 1.3 + (w.player.contracts.length <= 1 ? 0.2 : 0));
  // Rivalry: how contested your owned cells are (player share vs comp share where you sell)
  let contested = 0, owned = 0;
  for (const cf of live.cellFinance) {
    owned++;
    // approximate: if a cell has revenue but you're not dominant, it's contested
  }
  const rivalryRaw = w.comps.reduce((a, c) => a + c.products.length, 0); // more rival products = more rivalry
  const rivalry = clamp(0.25 + rivalryRaw * 0.12);
  // Threat of entrants: recent rival launches
  const launches = w.events.filter((e) => e.kind === "rival" && e.text.includes("launched") && e.tick > w.tick - 24 * 4).length;
  const entrants = clamp(0.2 + launches * 0.3);
  // Substitutes: cultural/natality shock reduces category certainty
  const substitutes = clamp(0.25 + (w.shock ? 0.35 : 0));
  // Supplier power: outsourced production = more supplier exposure
  const outsourcedShare = w.player.skus.length ? w.player.skus.filter((s) => s.method === "outsource").length / w.player.skus.length : 0.5;
  const supplier = clamp(0.3 + outsourcedShare * 0.25);

  return [
    { name: "Buyer Power", pressure: buyer, note: w.player.contracts.length <= 1 ? "You depend on a single channel that takes a large cut." : `Channels take ${pct(live.avgMarginCut)} of gross.` },
    { name: "Competitive Rivalry", pressure: rivalry, note: `${rivalryRaw} rival products competing across the cube.` },
    { name: "Threat of New Entrants", pressure: entrants, note: launches ? `${launches} rival product launch(es) recently.` : "No recent entries into your space." },
    { name: "Substitutes", pressure: substitutes, note: w.shock ? "A market shock is shifting where demand sits." : "Category demand is stable for now." },
    { name: "Supplier Power", pressure: supplier, note: outsourcedShare > 0.5 ? "Outsourced production exposes you to supplier terms." : "Mostly in-house — limited supplier leverage." },
  ];
}

// ---------------------------------------------------------------------------
// BCG matrix — growth (market trajectory of the product's cells) x relative share.
// ---------------------------------------------------------------------------
export type BcgClass = "Star" | "Cash Cow" | "Question Mark" | "Dog";
export interface BcgItem { sku: string; growth: number; relShare: number; klass: BcgClass; revenue: number; }

export function computeBcg(w: World): BcgItem[] {
  const live = w.live;
  if (!live) return [];
  return w.player.skus.map((s, i) => {
    const tgt = skuTarget(w, s);
    // weight cells by this sku's fit; growth = fit-weighted head change vs base
    let wsum = 0, growthAccum = 0, myAccum = 0, rivalAccum = 0;
    for (const cell of w.cube) {
      const f = fit(tgt, cell, w.cfg);
      if (f < 0.15) continue;
      wsum += f;
      growthAccum += f * ((cell.head - cell.baseHead) / cell.baseHead);
      // my strength vs the single strongest rival product, fit-weighted
      const myStrength = (cell.awareness[s.id] ?? 0) * f;
      let bestRival = 0;
      for (const c of w.comps) for (const cp of c.products) bestRival = Math.max(bestRival, (cell.awareness[cp.awarenessKey] ?? 0) * fit(cp.target, cell, w.cfg));
      myAccum += f * myStrength;
      rivalAccum += f * bestRival;
    }
    const growth = wsum ? growthAccum / wsum : 0;
    // relative share = my fit-weighted strength vs strongest rival's; bounded 0..3 for display
    const relShare = clamp(rivalAccum > 0.001 ? myAccum / rivalAccum : (myAccum > 0.001 ? 2 : 0), 0, 3);
    const rev = live.skuResults[i]?.revenue ?? 0;
    const highGrowth = growth > 0.003;
    const highShare = relShare > 1.0;
    // a product with negligible sales is a Dog in practice, whatever the abstract share math says
    const totalRev = sum(live.skuResults.map((r) => r.revenue)) || 1;
    const negligible = rev < totalRev * 0.03;
    const klass: BcgClass = negligible ? "Dog"
      : highGrowth ? (highShare ? "Star" : "Question Mark")
      : (highShare ? "Cash Cow" : "Dog");
    return { sku: s.name, growth, relShare, klass, revenue: rev };
  });
}

// ---------------------------------------------------------------------------
// Board memo — a generated quarterly narrative. Frames issues as questions.
// ---------------------------------------------------------------------------
export interface BoardMemo { headline: string; whatHappened: string[]; issues: string[]; }

export function computeBoardMemo(w: World): BoardMemo {
  const live = w.live;
  if (!live) return { headline: "Awaiting first results.", whatHappened: [], issues: [] };
  const I = live.income, F = live.cashflow;
  const happened: string[] = [];
  const issues: string[] = [];

  // what happened
  happened.push(`Net revenue ${money(I.netRevenue)}/Q on ${pct(live.overallShare)} market share; net profit ${money(I.profit)}/Q.`);
  if (Math.abs(I.profit - F.operatingCashFlow) > 200_000)
    happened.push(`Profit and operating cash flow diverged by ${money(Math.abs(I.profit - F.operatingCashFlow))} — working capital (${Math.round(F.cashCycleDays)}-day cycle) is the cause.`);
  const rivalEvents = w.events.filter((e) => e.kind === "rival" && e.tick > w.tick - 24);
  if (rivalEvents.length) happened.push(rivalEvents[rivalEvents.length - 1].text.replace(/^[^ ]+ /, ""));
  if (w.shock) happened.push(w.shock.type === "natality" ? "A natality crash is shrinking the youngest cohort." : `Population is drifting toward ${w.shock.dir}.`);

  // issues, framed as questions
  const bleeders = [...live.cellFinance].filter((c) => c.contribution < -10000).sort((a, b) => a.contribution - b.contribution);
  if (bleeders.length) issues.push(`Your position in ${coordLabel(bleeders[0].coord)} loses money each quarter. Do you reprice, cut marketing there, or exit?`);
  if (F.cash < 500_000 && I.profit > 0) issues.push(`You're profitable but cash is thin (${money(F.cash)}). Do you slow production, renegotiate faster-paying channels, or draw credit?`);
  if (live.avgMarginCut > 0.38) issues.push(`Retailers take ${pct(live.avgMarginCut)} of every sale. Is it time to build owned channels even at the cost of reach?`);
  const bcg = computeBcg(w);
  const dogs = bcg.filter((b) => b.klass === "Dog" && b.revenue > 0);
  if (dogs.length) issues.push(`${dogs[0].sku} is a low-share product in a flat market. Reposition it, harvest it, or kill it?`);
  const qmarks = bcg.filter((b) => b.klass === "Question Mark");
  if (qmarks.length) issues.push(`${qmarks[0].sku} sits in a growing market but you don't lead it. Do you invest to make it a Star before a rival does?`);
  if (issues.length === 0) issues.push("No acute issues this quarter. Where do you place the next bet before the market moves?");

  const headline = I.profit < 0
    ? "Losing money — the model needs attention."
    : F.cash < 0 ? "Profitable on paper, but out of cash."
    : live.overallShare > 0.05 ? "Holding a real position — now defend and extend it."
    : "Early traction. The bet is forming.";

  return { headline, whatHappened: happened, issues: issues.slice(0, 3) };
}

// formatting helpers (local, to keep module self-contained)
function money(v: number) { const a = Math.abs(v), s = v < 0 ? "-" : ""; if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`; if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}k`; return `${s}$${a.toFixed(0)}`; }
function num(v: number) { return v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : Math.round(v).toString(); }
function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }

// ---------------------------------------------------------------------------
// Product Analysis (Release 0.3) — best/worst cells for a product by combined fit.
// ---------------------------------------------------------------------------
export interface ProductCellFit { coord: { age: string; gender: string; class: string; leaning: string }; market: number; demoFit: number; needFit: number; combined: number; }
export interface ProductAnalysis { sku: string; best: ProductCellFit[]; worst: ProductCellFit[]; topNeeds: { label: string; value: number }[]; }

export function computeProductAnalysis(w: World): ProductAnalysis[] {
  return w.player.skus.map((s) => {
    const tgt = skuTarget(w, s);
    const rows: ProductCellFit[] = w.cube.map((cell) => {
      const demoFit = fit(tgt, cell, w.cfg);
      const needFit = needMatch(s.attributes, cell, w.cfg);
      return { coord: cell.coord, market: cell.head * cell.spend, demoFit, needFit, combined: demoFit * needFit };
    }).filter((r) => r.market > 0);
    const sorted = [...rows].sort((a, b) => b.combined - a.combined);
    const topNeeds = w.cfg.needs.map((n) => ({ label: n.label, value: s.attributes[n.key] ?? 0 })).sort((a, b) => b.value - a.value).slice(0, 3);
    return { sku: s.name, best: sorted.slice(0, 4), worst: sorted.slice(-3).reverse(), topNeeds };
  });
}
