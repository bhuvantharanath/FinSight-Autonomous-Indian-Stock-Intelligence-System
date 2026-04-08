"use client";

import { useState, useEffect, useMemo } from "react";
import type { SynthesisResult, AgentStatus } from "@/lib/api";

interface VerdictPanelProps {
  symbol: string;
  synthesis: SynthesisResult | null;
  agents: Record<string, AgentStatus>;
}

export default function VerdictPanel({ symbol, synthesis, agents }: VerdictPanelProps) {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [isCustom, setIsCustom] = useState(false);

  // Initialize weights if available
  useEffect(() => {
    if (synthesis?.agent_weights && Object.keys(weights).length === 0 && !isCustom) {
      // Backend returns float 0 to 1, convert to 0-100
      const initial: Record<string, number> = {};
      for (const [k, v] of Object.entries(synthesis.agent_weights)) {
        initial[k] = v * 100;
      }
      setWeights(initial);
    }
  }, [synthesis, isCustom, weights]);

  // Constrained weight editor logic
  const handleWeightChange = (agent: string, newTarget: number) => {
    setWeights(prev => {
      const oldVal = prev[agent] || 0;
      let delta = newTarget - oldVal;

      const others = Object.keys(prev).filter(k => k !== agent);
      const remainingSum = others.reduce((sum, k) => sum + prev[k], 0);

      // Bound delta so we don't drop others below 0
      if (delta > remainingSum) delta = remainingSum;

      const newWeights = { ...prev };
      newWeights[agent] = oldVal + delta;

      for (const k of others) {
        if (remainingSum <= 0) {
          newWeights[k] = 0;
        } else {
          newWeights[k] -= delta * (prev[k] / remainingSum);
        }
      }

      return newWeights;
    });
    setIsCustom(true);
  };

  const mlData = agents["ml"]?.data as any;
  const regime = mlData?.regime?.toUpperCase() || "UNKNOWN";

  const riskData = agents["risk"]?.data as any;
  const riskLevel = riskData?.risk_level?.toUpperCase() || "UNKNOWN";

  const macroData = agents["macro"]?.data as any;
  const macroSignal = macroData?.macro_signal?.toUpperCase();
  const fiiNet = macroData?.fii_net_5d;

  // Determine actual confidence using either backend or local recalculation
  const recalculated = useMemo(() => {
    if (!synthesis || !isCustom) {
      return { 
        verdict: synthesis?.final_verdict || "PENDING", 
        confidence: synthesis?.overall_confidence || 0 
      };
    }
    
    let totalW = 0;
    let score = 0;
    for (const [agentName, status] of Object.entries(agents)) {
      if (status.status !== "completed" || !status.signal || status.confidence === null) continue;
      
      const w = (weights[agentName] || 0) / 100;
      let dir = 0;
      if (status.signal === "BUY") dir = 1;
      if (status.signal === "SELL") dir = -1;
      
      score += dir * status.confidence * w;
      totalW += w;
    }

    if (totalW === 0) return { verdict: "HOLD", confidence: 0 };
    
    const finalScore = score / totalW;
    let verdict = "HOLD";
    if (finalScore >= 0.15) verdict = "BUY";
    if (finalScore <= -0.15) verdict = "SELL";

    return { verdict, confidence: Math.abs(finalScore) };
  }, [synthesis, weights, agents, isCustom]);

  const getVerdictLabelColor = (v: string) => {
    if (v === "BUY") return "text-[var(--color-war-buy)]";
    if (v === "SELL") return "text-[var(--color-war-sell)]";
    return "text-[var(--color-war-text)]";
  };

  const getVerdictBadgeColor = (v: string) => {
    if (v === "BUY") return "bg-[var(--color-war-buy)] text-white";
    if (v === "SELL") return "bg-[var(--color-war-sell)] text-white";
    return "bg-[var(--color-war-text)] text-white";
  };

  return (
    <div className="h-full flex flex-col border-l border-[var(--color-war-border)] bg-[#F5F2EC] overflow-y-auto">
      {/* 1. Newspaper-style header */}
      <div className="p-8 pb-6 border-b-2 border-[var(--color-war-text)]">
        <div className="flex justify-between items-center mb-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
            {new Date().toLocaleDateString("en-GB").replace(/\//g, ".")}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
            NSE INTELLIGENCE REPORT
          </span>
        </div>

        <h1 className="font-serif text-[48px] font-black text-[var(--color-war-text)] leading-tight mb-4 tracking-tighter">
          {symbol}:{" "}
          <span className={getVerdictLabelColor(recalculated.verdict)}>
            {recalculated.verdict}
          </span>
        </h1>

        <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-war-text)] flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--color-war-border)] pt-4">
          <span>Confidence: <strong className="font-sans font-black">{(recalculated.confidence * 100).toFixed(1)}%</strong></span>
          <span className="text-[#ccc]">|</span>
          <span>Regime: <strong className="font-sans font-black">{regime}</strong></span>
          <span className="text-[#ccc]">|</span>
          <span>Risk: <strong className="font-sans font-black">{riskLevel}</strong></span>
        </div>
      </div>

      <div className="p-8 space-y-8 flex-1">
        {/* 3. Macro warning bar */}
        {macroSignal === "BEARISH" && (
          <div className="bg-[#facc15] border border-[#ca8a04] px-4 py-3 font-mono text-xs font-bold text-[#854d0e] flex items-center shadow-sm">
            ⚠ MACRO WARNING: FIIs net sold ₹{fiiNet?.toFixed(2)}Cr in last 5 days
          </div>
        )}

        {/* 2. Weight editor */}
        <div className="border border-[var(--color-war-border)] bg-[#fdfdfc] p-6 shadow-sm">
          <div className="flex justify-between items-end mb-6 border-b border-[var(--color-war-border)] pb-2">
            <h3 className="font-serif text-lg font-bold text-[var(--color-war-text)] tracking-tight">
              Conviction Engine (What-If)
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">
              {isCustom ? "Scenario: Custom weights" : "Default weights"}
            </span>
          </div>

          <div className="space-y-4">
            {Object.keys(weights).length === 0 ? (
              <p className="font-mono text-xs text-[var(--color-war-muted)]">Awaiting agent weights...</p>
            ) : null}

            {Object.entries(weights).map(([agentName, weight]) => (
              <div key={agentName} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest">
                  <span className="font-bold text-[var(--color-war-text)]">{agentName}</span>
                  <span className="text-[var(--color-war-muted)]">{weight.toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={weight}
                  onChange={(e) => handleWeightChange(agentName, parseFloat(e.target.value))}
                  className="w-full appearance-none h-[2px] bg-[var(--color-war-border)] outline-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--color-war-text) 0%, var(--color-war-text) ${weight}%, var(--color-war-border) ${weight}%, var(--color-war-border) 100%)`
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between items-center bg-[#F5F2EC] p-3 border border-[var(--color-war-border)]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-war-text)]">
              Real-time Output:
            </span>
            <span className={`px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider ${getVerdictBadgeColor(recalculated.verdict)}`}>
              {recalculated.verdict} / {(recalculated.confidence * 100).toFixed(1)}%
            </span>
          </div>
          
          {isCustom && (
            <button 
              onClick={() => setIsCustom(false)}
              className="mt-3 w-full border border-[var(--color-war-border)] py-1.5 font-mono text-[9px] uppercase tracking-widest text-[var(--color-war-muted)] hover:bg-[#e8e4db] transition-colors"
            >
              Reset to Base Defaults
            </button>
          )}
        </div>

        {/* 4. Mock Backtest Accuracy Badge */}
        <div className="border border-[var(--color-war-border)] bg-[#fdfdfc] p-4 text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-war-muted)]">
            AI accuracy on {symbol}: <strong className="text-[var(--color-war-text)]">7/10 past predictions correct</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
