"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, ArrowRight, BarChart3 } from "lucide-react";
import * as api from "@/lib/api";
import type { RecentRun } from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  let classes = "";
  switch (status) {
    case "completed":
      classes =
        "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400";
      break;
    case "running":
      classes =
        "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 animate-pulse";
      break;
    case "failed":
      classes = "bg-red-500/10 border border-red-500/30 text-red-400";
      break;
    default:
      classes = "bg-slate-500/10 border border-slate-700 text-slate-400";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {status}
    </span>
  );
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "In progress...";
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;
  if (diffMs < 1000) return "<1s";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  return `${minutes}m ${remainingSec}s`;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-t border-slate-800">
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-slate-800 animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<RecentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const data = await api.getRecentRuns();
        setRuns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load runs");
      } finally {
        setLoading(false);
      }
    }
    fetchRuns();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="h-6 w-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Analysis History</h1>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Run ID
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Symbols
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Started
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows />}

              {!loading && runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <BarChart3 className="h-10 w-10 text-slate-600" />
                      <p className="text-slate-400 text-sm">
                        No analyses run yet.
                      </p>
                      <Link
                        href="/"
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-all duration-200"
                      >
                        Go analyze some stocks! →
                      </Link>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                runs.map((run) => (
                  <tr
                    key={run.run_id}
                    className="border-t border-slate-800 hover:bg-slate-800/30 transition-all duration-200"
                  >
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm font-mono">
                        {run.run_id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {run.symbols.map((sym) => (
                          <span
                            key={sym}
                            className="bg-slate-800 text-slate-300 text-xs rounded-md px-2 py-0.5"
                          >
                            {sym}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {new Date(run.started_at).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {formatDuration(run.started_at, run.completed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/run/${run.run_id}`}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-all duration-200"
                      >
                        View Results
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
