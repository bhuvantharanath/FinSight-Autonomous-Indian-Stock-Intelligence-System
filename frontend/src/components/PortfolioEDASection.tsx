"use client";

import type { MultiStockEDA } from "@/lib/api";
import CorrelationHeatmap from "./charts/CorrelationHeatmap";
import { Activity } from "lucide-react";

interface PortfolioEDASectionProps {
  multiEDA: MultiStockEDA;
}

export default function PortfolioEDASection({
  multiEDA,
}: PortfolioEDASectionProps) {
  if (!multiEDA || multiEDA.symbols.length <= 1) return null;

  // Find top correlations (excluding self-correlations of 1.0)
  const allPairs = multiEDA.correlation_matrix?.filter((p) => p.symbol_a !== p.symbol_b) || [];
  // Sort by absolute correlation to find the strongest relationships
  const topPairs = [...allPairs]
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, 3); // Take top 3

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="h-5 w-5 text-indigo-400" />
        <h2 className="text-xl font-bold text-white">Portfolio Analysis</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 flex flex-col space-y-6">
          <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 text-slate-300 text-sm leading-relaxed bg-slate-800/30 rounded-r-lg">
            {multiEDA.portfolio_summary ||
              "Cross-asset correlation analysis indicates the systemic risk profile and diversification benefits across the selected basket."}
          </blockquote>

          {topPairs.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">
                Strongest Relationships
              </h3>
              <div className="space-y-3">
                {topPairs.map((pair, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="text-slate-200">{pair.symbol_a}</span>
                      <span className="text-slate-600 text-xs text-[10px]">&harr;</span>
                      <span className="text-slate-200">{pair.symbol_b}</span>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-bold ${
                          pair.correlation > 0.5
                            ? "text-emerald-400"
                            : pair.correlation < -0.5
                            ? "text-red-400"
                            : "text-slate-300"
                        }`}
                      >
                        {pair.correlation > 0 ? "+" : ""}
                        {pair.correlation.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 capitalize">
                        {pair.relationship.replace(/_/g, " ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-400 mb-6 text-center">
            Cross-Asset Correlation Matrix
          </h3>
          <CorrelationHeatmap correlationGrid={multiEDA.correlation_grid} />
        </div>
      </div>
    </div>
  );
}
