export const C = {
  bg: "#0a0e14", panel: "#0f1620", panel2: "#131c28", line: "#1e2b3a",
  ink: "#e6edf3", dim: "#7d8da0", faint: "#4a5a6e",
  green: "#3fd07f", red: "#ff5d6c", amber: "#ffb340", cyan: "#34c3ff", violet: "#a78bfa", grid: "#16202c",
};
export const SERIES = [C.cyan, C.amber, C.violet, C.green, C.red];

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

export const ctrlBtn: React.CSSProperties = { background: C.panel2, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
export const bigBtn: React.CSSProperties = { background: C.cyan, color: "#06121c", border: "none", borderRadius: 8, padding: "12px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
