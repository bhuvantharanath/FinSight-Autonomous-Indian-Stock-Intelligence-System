"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import * as api from "@/lib/api";
import type { RunStatus, MultiStockEDA, MLPrediction } from "@/lib/api";
import AgentGrid from "@/components/AgentGrid";
import VerdictCard from "@/components/VerdictCard";
import ConfidenceRadar from "@/components/ConfidenceRadar";
import EDASection from "@/components/EDASection";
import PortfolioEDASection from "@/components/PortfolioEDASection";
import MLPredictionCard from "@/components/charts/MLPredictionCard";
import AnalysisLoadingSkeleton from "@/components/AnalysisLoadingSkeleton";

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

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingSymbol, setDownloadingSymbol] = useState<string | null>(
    null
  );
  const [edaData, setEdaData] = useState<MultiStockEDA | null>(null);
  const [mlData, setMlData] = useState<Record<string, MLPrediction>>({});
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [isFetchingEDA, setIsFetchingEDA] = useState(false);
  const [isFetchingML, setIsFetchingML] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    async function fetchInitial() {
      try {
        const status = await api.getRunStatus(runId);
        setRunStatus(status);
        setLoading(false);

        // Fetch EDA and ML if complete on first load
        if (status.status === "completed") {
          setIsFetchingEDA(true);
          try {
            const eda = await api.getEDA(runId);
            setEdaData(eda);
          } catch (e) {
            console.error("EDA not found or failed", e);
          } finally {
            setIsFetchingEDA(false);
          }

          setIsFetchingML(true);
          const mlDict: Record<string, MLPrediction> = {};
          try {
            for (const sym of status.symbols) {
              try {
                const ml = await api.getMLPrediction(runId, sym);
                mlDict[sym] = ml;
              } catch (e) {
                console.error(`ML not found for ${sym}`, e);
              }
              setActiveTabs((prev) => ({ ...prev, [sym]: "Overview" }));
            }
            setMlData(mlDict);
          } finally {
            setIsFetchingML(false);
          }
        }

        if (status.status === "running") {
          pollingRef.current = setInterval(async () => {
            try {
              const updated = await api.getRunStatus(runId);
              setRunStatus(updated);
              if (
                updated.status === "completed" ||
                updated.status === "failed"
              ) {
                clearPolling();
                if (updated.status === "completed") {
                  setIsFetchingEDA(true);
                  try {
                    const eda = await api.getEDA(runId);
                    setEdaData(eda);
                  } catch (e) {
                    console.error("EDA not found or failed", e);
                  } finally {
                    setIsFetchingEDA(false);
                  }

                  setIsFetchingML(true);
                  const mlDict: Record<string, MLPrediction> = {};
                  try {
                    for (const sym of updated.symbols) {
                      try {
                        const ml = await api.getMLPrediction(runId, sym);
                        mlDict[sym] = ml;
                      } catch (e) {
                        console.error(`ML not found for ${sym}`, e);
                      }
                      setActiveTabs((prev) => ({ ...prev, [sym]: "Overview" }));
                    }
                    setMlData(mlDict);
                  } finally {
                    setIsFetchingML(false);
                  }
                }
              }
            } catch {
              clearPolling();
            }
          }, 2000);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load run details"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();

    return () => {
      clearPolling();
    };
  }, [runId, clearPolling]);

  const handleDownloadReport = async (symbol: string) => {
    setDownloadingSymbol(symbol);
    try {
      const report = await api.getReport(runId, symbol);
      const blob = new Blob([report], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${symbol}_report_${runId.slice(0, 8)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download report:", err);
    } finally {
      setDownloadingSymbol(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !runStatus) {
    return (
      <div className="min-h-screen bg-slate-950 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to History
          </Link>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">{error ?? "Run not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Link>

        {/* Run metadata */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-white">
                  Run {runStatus.run_id.slice(0, 8)}...
                </h1>
                <StatusBadge status={runStatus.status} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {runStatus.symbols.map((sym) => (
                  <span
                    key={sym}
                    className="bg-slate-800 text-slate-300 text-xs rounded-md px-2 py-0.5"
                  >
                    {sym}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right text-sm text-slate-400 space-y-0.5">
              <p>
                Started:{" "}
                {new Date(runStatus.started_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {runStatus.completed_at && (
                <p>
                  Completed:{" "}
                  {new Date(runStatus.completed_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio EDA (cross-asset analysis) */}
        {edaData && runStatus.symbols.length > 1 && (
          <PortfolioEDASection multiEDA={edaData} />
        )}

        {/* Per-symbol results */}
        {runStatus.symbols.map((symbol) => {
          const currentTab = activeTabs[symbol] || "Overview";
          return (
            <div
              key={symbol}
              className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">{symbol}</h2>
                {runStatus.results[symbol] && (
                  <button
                    onClick={() => handleDownloadReport(symbol)}
                    disabled={downloadingSymbol === symbol}
                    className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {downloadingSymbol === symbol ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download Report
                  </button>
                )}
              </div>

              {/* TABS */}
              <div className="flex gap-6 border-b border-slate-800 mb-6 overflow-x-auto">
                {["Overview", "EDA Analysis", "ML Prediction", "Research Report"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTabs((prev) => ({ ...prev, [symbol]: tab }))}
                    className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      currentTab === tab
                        ? "text-indigo-400 border-b-2 border-indigo-400"
                        : "text-slate-400 hover:text-slate-300"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT */}
              <div className="min-h-[300px]">
                {currentTab === "Overview" && (
                  <>
                    {runStatus.results[symbol] && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <div className="lg:col-span-2">
                          <VerdictCard result={runStatus.results[symbol]} />
                        </div>
                        <div>
                          <ConfidenceRadar agents={runStatus.agents} symbol={symbol} />
                        </div>
                      </div>
                    )}
                    <AgentGrid agents={runStatus.agents} symbol={symbol} />
                  </>
                )}

                {currentTab === "EDA Analysis" && (
                  <>
                    {isFetchingEDA ? (
                      <AnalysisLoadingSkeleton type="eda" />
                    ) : edaData && edaData.individual_eda[symbol] ? (
                      <EDASection symbol={symbol} edaResult={edaData.individual_eda[symbol]} />
                    ) : (
                      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                        EDA analysis data not available.
                      </div>
                    )}
                  </>
                )}

                {currentTab === "ML Prediction" && (
                  <>
                    {isFetchingML ? (
                      <AnalysisLoadingSkeleton type="ml" />
                    ) : mlData[symbol] ? (
                      <MLPredictionCard prediction={mlData[symbol]} />
                    ) : (
                      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                        Machine Learning prediction not available.
                      </div>
                    )}
                  </>
                )}

                {currentTab === "Research Report" && (
                  <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
                    {runStatus.results[symbol] ? (
                      <div className="prose prose-invert prose-slate max-w-none prose-h1:text-2xl prose-h2:text-xl prose-a:text-indigo-400">
                        <div
                          dangerouslySetInnerHTML={{
                            __html: runStatus.results[symbol].detailed_report
                              .replace(/\n\n/g, "</p><p>")
                              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                              .replace(/^# (.*$)/gm, "<h1>$1</h1>")
                              .replace(/^## (.*$)/gm, "<h2>$1</h2>")
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                        Research report generating...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
