"use client";

import { useState } from "react";
import type { EDAResult } from "@/lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import CandlestickChart from "./charts/CandlestickChart";
import ReturnsHistogram from "./charts/ReturnsHistogram";
import VolatilityChart from "./charts/VolatilityChart";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface EDASectionProps {
  symbol: string;
  edaResult: EDAResult;
}

export default function EDASection({ symbol, edaResult }: EDASectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!edaResult) return null;

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden mb-8 shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 bg-slate-800/20 hover:bg-slate-800/40 transition-colors border-b border-slate-800"
      >
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          EDA Analysis <span className="text-slate-500 font-normal">—</span> <span className="text-indigo-400">{symbol}</span>
        </h2>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-6 space-y-8 animate-fadeIn">
          {/* Row 1: 4 Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Daily Returns */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">Daily Returns</div>
                <div className="flex gap-4">
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Mean</div>
                    <div className="text-lg font-semibold text-slate-200">
                      {(edaResult.returns_distribution.mean * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Std Dev</div>
                    <div className="text-lg font-semibold text-slate-200">
                      {(edaResult.returns_distribution.std * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    edaResult.returns_distribution.is_normal
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {edaResult.returns_distribution.is_normal ? "Normal Dist" : "Non-Normal"}
                </span>
              </div>
            </div>

            {/* Card 2: Volatility Regime */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">Volatility Regime</div>
                <div
                  className={`text-2xl font-bold uppercase tracking-tight py-1 ${
                    edaResult.volatility_regime.regime === "high"
                      ? "text-red-400"
                      : edaResult.volatility_regime.regime === "low"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {edaResult.volatility_regime.regime}
                </div>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  <span className="text-slate-300 font-medium">
                    {edaResult.volatility_regime.current_percentile.toFixed(1)}th
                  </span>{" "}
                  percentile historically
                </div>
                <div>
                  Avg daily move:{" "}
                  <span className="text-slate-300 font-medium">
                    {(edaResult.volatility_regime.avg_daily_move_pct * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Skewness */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">Skewness</div>
                <div className="text-2xl font-semibold text-slate-200">
                  {edaResult.returns_distribution.skewness.toFixed(2)}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 mt-1">
                  {edaResult.returns_distribution.skewness > 0.5
                    ? "Positive Skew"
                    : edaResult.returns_distribution.skewness < -0.5
                    ? "Negative Skew"
                    : "Symmetric"}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                {edaResult.returns_distribution.skewness > 0.5
                  ? "Frequent small losses, intermittent large gains."
                  : edaResult.returns_distribution.skewness < -0.5
                  ? "Frequent small gains, intermittent large losses."
                  : "Balanced distribution of gains and losses."}
              </div>
            </div>

            {/* Card 4: Key Events */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">Key Events</div>
                <div className="text-lg font-semibold text-slate-200">
                  {edaResult.outliers?.length || 0} outliers detected
                </div>
              </div>
              <ul className="text-xs mt-2 space-y-1.5 line-clamp-3">
                {(edaResult.outliers || []).slice(0, 2).map((evt, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-500 whitespace-nowrap">
                      {new Date(evt.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-slate-300 truncate">
                      {evt.event_type.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Row 2: Key Insights */}
          {edaResult.key_insights && edaResult.key_insights.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 ml-1">Key Findings</h3>
              <div className="flex flex-wrap gap-2">
                {edaResult.key_insights.map((insight, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 shadow-sm"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Charts (Price & Distribution) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/30 p-1 md:p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-4 ml-2">Price Action & Trends</h3>
              <CandlestickChart symbol={symbol} priceData={edaResult.price_vs_sma} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-4 ml-2">Return Distribution</h3>
              <ReturnsHistogram symbol={symbol} histogram={edaResult.returns_histogram} />
            </div>
          </div>

          {/* Row 4: Charts (Volatility & Events) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/30 p-1 md:p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-4 ml-2">Rolling 30-Day Volatility</h3>
              <VolatilityChart symbol={symbol} volData={edaResult.rolling_volatility_30d} />
            </div>
            
            {(edaResult.outliers?.length ?? 0) > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-4 ml-2">Significant Events Timeline</h3>
                <div className="w-full h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        }}
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      {/* Hide Y Axis, just want a timeline horizontal look */}
                      <YAxis type="number" dataKey="index" hide domain={[-1, 1]} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#1e293b",
                          borderRadius: "0.5rem",
                          color: "#f8fafc",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, name: any, props: any) => {
                          const { z_score, event_type, value: evtVal } = props.payload;
                          return [
                            `Val: ${evtVal.toFixed(2)}, Z: ${z_score.toFixed(1)}`,
                            event_type.replace(/_/g, " ").toUpperCase(),
                          ];
                        }}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Scatter
                        data={edaResult.outliers.map((o) => ({ ...o, index: 0 }))}
                        shape="circle"
                      >
                        {edaResult.outliers.map((entry, index) => {
                          // red for price gap, amber for volume spike
                          const isVol = entry.event_type.toLowerCase().includes("volume");
                          return (
                            <Cell key={`cell-${index}`} fill={isVol ? "#f59e0b" : "#ef4444"} />
                          );
                        })}
                      </Scatter>
                      {/* A fake timeline base line */}
                      <Scatter
                        data={[{ date: edaResult.outliers[0]?.date, index: 0 }, { date: edaResult.outliers[edaResult.outliers.length - 1]?.date, index: 0 }]}
                        line={{ stroke: "#334155", strokeWidth: 2 }}
                        shape={() => null}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
