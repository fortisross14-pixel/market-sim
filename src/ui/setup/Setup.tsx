import React, { useState } from "react";
import { C, bigBtn, ctrlBtn } from "../theme";
import { Panel, ChoiceCard, Center, FieldLabel, TextInput } from "../components";
import { INDUSTRIES, BRAND_COLORS, POSITIONINGS } from "../../engine/industries";
import type { Brand } from "../../engine/types";

export function Home({ onStart }: { onStart: () => void }) {
  return (
    <Center>
      <div style={{ textAlign: "center", maxWidth: 580 }}>
        <div style={{ fontSize: 13, color: C.cyan, letterSpacing: 4, marginBottom: 8 }}>◈ MARKET / SIM</div>
        <h1 style={{ fontSize: 40, margin: "0 0 12px", fontWeight: 700 }}>The market is a moving target.<br />Find your bet.</h1>
        <p style={{ color: C.dim, fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          The population is people across age, class, gender and leaning. Spot an underserved corner, build for it,
          earn awareness from zero — and watch whether the profit is real once cash, channels and rivals are in play.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          <button style={bigBtn} onClick={onStart}>▶ Sandbox</button>
          <button style={{ ...bigBtn, background: C.panel2, color: C.faint, cursor: "not-allowed" }} disabled>Scenarios — soon</button>
        </div>
      </div>
    </Center>
  );
}

export function SetupWizard({ onLaunch }: { onLaunch: (id: string, company: string, brand: Brand, cash: number) => void }) {
  const [step, setStep] = useState(0);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [brand, setBrand] = useState<Brand>({ name: "", color: BRAND_COLORS[0], positioning: "premium" });
  const startCash = 3_000_000;

  return (
    <Center>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {["Industry", "Company", "Brand"].map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? C.cyan : C.line }} />)}
        </div>
        {step === 0 && (
          <Panel title="Choose your industry">
            <div style={{ display: "flex", gap: 12 }}>
              {Object.values(INDUSTRIES).map((ind) => (
                <ChoiceCard key={ind.id} active={industryId === ind.id} onClick={() => setIndustryId(ind.id)}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{ind.label}</div>
                  <div style={{ color: C.dim, fontSize: 12 }}>Matters most: {Object.entries(ind.axisWeight).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).join(", ")}</div>
                </ChoiceCard>
              ))}
            </div>
            <div style={{ marginTop: 16, color: C.dim, fontSize: 13 }}>Starting capital: <span style={{ color: C.green, fontFamily: "ui-monospace" }}>${(startCash / 1e6).toFixed(1)}M</span></div>
            <div style={{ marginTop: 16, textAlign: "right" }}><button style={bigBtn} disabled={!industryId} onClick={() => setStep(1)}>Next →</button></div>
          </Panel>
        )}
        {step === 1 && (
          <Panel title="Name your company">
            <FieldLabel>Company name</FieldLabel>
            <TextInput placeholder="e.g. Meridian Holdings" value={company} onChange={(e) => setCompany(e.target.value)} />
            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
              <button style={ctrlBtn} onClick={() => setStep(0)}>← Back</button>
              <button style={bigBtn} disabled={!company.trim()} onClick={() => setStep(2)}>Next →</button>
            </div>
          </Panel>
        )}
        {step === 2 && (
          <Panel title="Launch your first brand">
            <FieldLabel>Brand name</FieldLabel>
            <TextInput placeholder="e.g. Lumina" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} />
            <div style={{ height: 16 }} />
            <FieldLabel>Brand color</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {BRAND_COLORS.map((c) => <button key={c} onClick={() => setBrand({ ...brand, color: c })} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: brand.color === c ? `3px solid ${C.violet}` : "2px solid transparent", cursor: "pointer", boxShadow: brand.color === c ? "0 0 0 2px #fff" : "none" }} />)}
            </div>
            <div style={{ height: 16 }} />
            <FieldLabel>Positioning</FieldLabel>
            <div style={{ display: "flex", gap: 10 }}>
              {POSITIONINGS.map((p) => (
                <ChoiceCard key={p.key} active={brand.positioning === p.key} onClick={() => setBrand({ ...brand, positioning: p.key })} accent={brand.color}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
                  <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.4 }}>{p.blurb}</div>
                </ChoiceCard>
              ))}
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
              <button style={ctrlBtn} onClick={() => setStep(1)}>← Back</button>
              <button style={{ ...bigBtn, background: brand.color }} disabled={!brand.name.trim()} onClick={() => onLaunch(industryId!, company, brand, startCash)}>Create company →</button>
            </div>
          </Panel>
        )}
      </div>
    </Center>
  );
}
