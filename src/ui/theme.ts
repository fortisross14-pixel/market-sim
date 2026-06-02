// ============================================================================
// White/purple dashboard theme — inspired by modern SaaS dashboards.
// Clean, airy, with purple accents and subtle shadows.
// ============================================================================
export const C = {
  bg: "#f5f5f9",           // light gray page background
  panel: "#ffffff",         // card/panel white
  panel2: "#f0eef6",        // slightly tinted card sections
  line: "#e2e0ec",          // subtle purple-gray borders
  ink: "#1e1b2e",           // near-black text
  dim: "#6b6580",           // secondary text (purple-gray)
  faint: "#a09bb3",         // tertiary/placeholder text
  green: "#22c55e",         // positive / success
  red: "#ef4444",           // negative / danger
  amber: "#f59e0b",         // warning / novelty
  cyan: "#6366f1",          // primary action (indigo-purple, NOT cyan anymore)
  violet: "#7c3aed",        // accent purple
  grid: "#eae8f0",          // table grid lines
};
export const SERIES = ["#6366f1", "#f59e0b", "#7c3aed", "#22c55e", "#ef4444"];

export const fmtMoney = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}k`;
  return `${s}$${a.toFixed(0)}`;
};
export const fmtNum = (v: number) =>
  v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : Math.round(v).toString();
export const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

export const ctrlBtn: React.CSSProperties = {
  background: C.panel, color: C.dim, border: `1px solid ${C.line}`,
  borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
  cursor: "pointer", transition: "all 0.15s",
};
export const bigBtn: React.CSSProperties = {
  background: C.violet, color: "#ffffff", border: "none",
  borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700,
  cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,0.25)", transition: "all 0.15s",
};
