"use client";

import { Loader2 } from "lucide-react";
import type { RunStatus } from "@/lib/api";
import AgentGrid from "./AgentGrid";
import VerdictCard from "./VerdictCard";
import ConfidenceRadar from "./ConfidenceRadar";

interface AnalysisProgressProps {
  runStatus: RunStatus | null;
  isPolling: boolean;
}

function countAgents(runStatus: RunStatus): {
  total: number;
  completed: number;
} {
  let total = 0;
  let completed = 0;
  for (const symbol of Object.keys(runStatus.agents)) {
    for (const agentName of Object.keys(runStatus.agents[symbol])) {
      total++;
      const status = runStatus.agents[symbol][agentName].status;
      if (status === "completed" || status === "failed") {
        completed++;
      }
    }
  }
  return { total, completed };
}

export default function AnalysisProgress({
  runStatus,
  isPolling,
}: AnalysisProgressProps) {
  if (!runStatus && isPolling) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-slate-400 text-sm">
          Initializing analysis pipeline...
        </p>
      </div>
    );
  }

  if (!runStatus) return null;

  const { total, completed } = countAgents(runStatus);
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overall status bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-500 text-xs font-mono">
            Run ID: {runStatus.run_id.slice(0, 8)}...
          </span>
          {runStatus.status === "failed" && (
            <span className="text-red-400 text-xs font-medium">Failed</span>
          )}
          {runStatus.status === "completed" && (
            <span className="text-emerald-400 text-xs font-medium">
              Completed
            </span>
          )}
          {runStatus.status === "running" && (
            <span className="text-indigo-400 text-xs font-medium">
              Running
            </span>
          )}
        </div>
        <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              runStatus.status === "failed"
                ? "bg-red-500"
                : runStatus.status === "completed"
                  ? "bg-emerald-500"
                  : "bg-indigo-500"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-slate-500 text-xs mt-1.5">
          {completed} / {total} agents complete ({progressPct}%)
        </p>
      </div>

      {/* Per-symbol sections */}
      {runStatus.symbols.map((symbol) => (
        <div key={symbol} className="space-y-4">
          <AgentGrid agents={runStatus.agents} symbol={symbol} />

          {runStatus.results[symbol] && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <VerdictCard result={runStatus.results[symbol]} />
              </div>
              <div>
                <ConfidenceRadar agents={runStatus.agents} symbol={symbol} />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Error state */}
      {runStatus.status === "failed" && !Object.keys(runStatus.results).length && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-medium">Analysis Failed</p>
          <p className="text-red-300/70 text-sm mt-1">
            One or more agents encountered an error. Check the agent cards above
            for details.
          </p>
        </div>
      )}
    </div>
  );
}
