import React from "react";
import { Game } from "./ui/Game";
import { C } from "./ui/theme";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  constructor(p: { children: React.ReactNode }) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, padding: 30, fontFamily: "ui-monospace, monospace" }}>
          <h2 style={{ color: C.red }}>Runtime error</h2>
          <pre style={{ color: C.amber, fontSize: 12, whiteSpace: "pre-wrap" }}>{String(this.state.err.stack || this.state.err)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><Game /></ErrorBoundary>;
}
