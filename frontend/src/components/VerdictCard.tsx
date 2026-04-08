"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { SynthesisResult } from "@/lib/api";
import { formatPriceTarget, getSignalColor } from "@/lib/utils";
import SignalBadge from "./SignalBadge";

interface VerdictCardProps {
  result: SynthesisResult;
}

const WEIGHT_LABELS: Record<string, string> = {
  technical: "Technical",
  fundamental: "Fundamental",
  sentiment: "Sentiment",
  risk: "Risk",
};

const WEIGHT_COLORS: Record<string, string> = {
  technical: "bg-indigo-500",
  fundamental: "bg-cyan-500",
  sentiment: "bg-violet-500",
  risk: "bg-amber-500",
};

export default function VerdictCard({ result }: VerdictCardProps) {
  const [showReport, setShowReport] = useState(false);

  const priceColor =
    result.price_target_pct >= 0 ? "text-emerald-400" : "text-red-400";
  const signalColor = getSignalColor(result.final_verdict);
  const confidencePct = Math.min(
    100,
    Math.max(0, Math.round(result.overall_confidence * 100))
  );
  const confidenceRadius = 40;
  const confidenceStrokeWidth = 6;
  const confidenceCircumference = 2 * Math.PI * confidenceRadius;
  const confidenceDashOffset =
    confidenceCircumference * (1 - confidencePct / 100);

  const generatedDate = new Date(result.generated_at).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">{result.symbol}</h2>
        <span className="text-slate-500 text-xs">{generatedDate}</span>
      </div>

      {/* Main verdict */}
      <div className="flex flex-col items-center gap-4 mb-6">
        <SignalBadge signal={result.final_verdict} size="lg" />
        <div className="relative h-24 w-24" aria-label={`Confidence ${confidencePct}%`}>
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={confidenceRadius}
              fill="none"
              stroke="#334155"
              strokeWidth={confidenceStrokeWidth}
            />
            <circle
              cx="50"
              cy="50"
              r={confidenceRadius}
              fill="none"
              stroke="currentColor"
              strokeWidth={confidenceStrokeWidth}
              strokeLinecap="round"
              strokeDasharray={confidenceCircumference}
              strokeDashoffset={confidenceDashOffset}
              className={`${signalColor} transition-all duration-500`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-semibold ${signalColor}`}>
              {confidencePct}%
            </span>
          </div>
        </div>
      </div>

      {/* Price target */}
      <div className="text-center mb-6">
        <span className={`text-3xl font-bold ${priceColor}`}>
          {formatPriceTarget(result.price_target_pct)}
        </span>
        <p className="text-slate-500 text-xs mt-1">12M Price Target</p>
      </div>

      {/* Summary */}
      <p className="text-slate-300 text-sm mb-4 leading-relaxed">
        {result.summary}
      </p>

      {/* Conflict notes */}
      {result.conflict_notes && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-amber-300 text-xs leading-relaxed">
            {result.conflict_notes}
          </p>
        </div>
      )}

      {/* Agent weights */}
      <div className="mb-4">
        <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-3">
          Agent Weights
        </h4>
        <div className="space-y-2">
          {Object.entries(WEIGHT_LABELS).map(([key, label]) => {
            const weight = result.agent_weights[key] ?? 0;
            const pct = Math.round(weight * 100);
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-slate-400 text-xs w-24 shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${WEIGHT_COLORS[key] ?? "bg-slate-500"} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-slate-500 text-xs w-8 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable full report */}
      <button
        onClick={() => setShowReport(!showReport)}
        className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-all duration-200 cursor-pointer"
      >
        {showReport ? (
          <>
            <ChevronUp className="h-4 w-4" />
            Hide Full Report
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            View Full Report
          </>
        )}
      </button>

      {showReport && (
        <div className="mt-4 bg-slate-800/50 border border-slate-700 rounded-xl p-4 overflow-auto max-h-96">
          <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {result.detailed_report}
          </pre>
        </div>
      )}
    </div>
  );
}
