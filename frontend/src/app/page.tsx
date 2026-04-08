"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Sparkles } from "lucide-react";
import * as api from "@/lib/api";
import type { RunStatus } from "@/lib/api";
import AnalysisProgress from "@/components/AnalysisProgress";

export default function HomePage() {
  const [symbolInput, setSymbolInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const hasScrolledToResultsRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  useEffect(() => {
    if (runStatus?.status === "completed" && !hasScrolledToResultsRef.current) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      hasScrolledToResultsRef.current = true;
    }
  }, [runStatus]);

  const handleStartAnalysis = async () => {
    const symbols = symbolInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0)
      .slice(0, 5);

    if (symbols.length === 0) {
      setError("Enter at least one stock symbol");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setRunStatus(null);
    hasScrolledToResultsRef.current = false;
    clearPolling();

    try {
      const { run_id } = await api.startAnalysis(symbols);

      pollingRef.current = setInterval(async () => {
        try {
          const status = await api.getRunStatus(run_id);
          setRunStatus(status);

          if (status.status === "completed" || status.status === "failed") {
            clearPolling();
            setIsAnalyzing(false);
          }
        } catch (pollErr) {
          setError(
            pollErr instanceof Error ? pollErr.message : "Polling error"
          );
          clearPolling();
          setIsAnalyzing(false);
        }
      }, 2000);
    } catch (startErr) {
      setError(
        startErr instanceof Error
          ? startErr.message
          : "Failed to start analysis"
      );
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Hero / Header */}
      <header className="text-center py-12 px-4">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            FinSight
          </h1>
        </div>
        <p className="text-slate-400 text-base">
          Autonomous Multi-Agent Indian Stock Intelligence
        </p>
      </header>

      {/* Input section */}
      <section className="max-w-2xl mx-auto w-full px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <label
            htmlFor="symbolInput"
            className="block text-slate-300 text-sm font-medium mb-2"
          >
            Enter NSE Stock Symbols
          </label>
          <input
            id="symbolInput"
            type="text"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isAnalyzing) {
                handleStartAnalysis();
              }
            }}
            placeholder="RELIANCE, ICICIBANK, ADANIGREEN, TCS"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
          />
          <p className="text-slate-500 text-xs mt-1">
            Separate multiple symbols with commas. Max 5 stocks.
          </p>

          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-base flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Running Analysis...
              </>
            ) : (
              "Analyze"
            )}
          </button>

          {error && (
            <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section
        ref={resultsRef}
        className="max-w-6xl mx-auto w-full px-4 mt-8 flex-1"
      >
        <AnalysisProgress runStatus={runStatus} isPolling={isAnalyzing} />
      </section>

      {/* Footer */}
      <footer className="text-center text-slate-600 text-xs py-8 px-4">
        FinSight is for educational purposes only. Not SEBI-registered
        investment advice.
      </footer>
    </div>
  );
}
