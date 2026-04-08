"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import * as api from "@/lib/api";
import type { RunStatus } from "@/lib/api";
import IntelligenceFeed from "@/components/IntelligenceFeed";
import ChartRoom from "@/components/warroom/ChartRoom";
import VerdictPanel from "@/components/VerdictPanel";
import EvidenceTrail from "@/components/EvidenceTrail";
import { OHLCVPoint, AgentSignal } from "@/components/charts/CandlestickChart";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function WarRoomPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [activeSymbol, setActiveSymbol] = useState<string>("");

  const [chartData, setChartData] = useState<OHLCVPoint[]>([]);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  
  useEffect(() => {
    // We use EventSource to trigger status refetches
    const sseUrl = `${API_BASE_URL}/stream/${runId}`;

    const updateStatus = () => {
      api.getRunStatus(runId).then((rs) => {
        setRunStatus(rs);
        setActiveSymbol((prev) => (!prev && rs.symbols.length > 0 ? rs.symbols[0] : prev));
      }).catch(console.error);
    };

    // Fetch status immediately on mount
    updateStatus();

    const source = new EventSource(sseUrl);

    source.addEventListener("status", () => {
      updateStatus();
    });

    source.addEventListener("done", () => {
      source.close();
      updateStatus();
    });

    source.addEventListener("error", () => {
      source.close();
    });

    return () => {
      source.close();
    };
  }, [runId]);

  // When activeSymbol or runStatus changes, update Chart
  useEffect(() => {
    if (!activeSymbol || !runStatus) return;

    // Fetch OHLCV direct from ingestion agent if available
    const ingestionAgent = runStatus.agents[activeSymbol]?.["data_ingestion"];
    if (ingestionAgent?.data?.dates) {
      const d = ingestionAgent.data;
      const mapped: OHLCVPoint[] = [];
      for (let i = 0; i < d.dates.length; i++) {
        mapped.push({
          time: d.dates[i],
          open: d.opens[i],
          high: d.highs[i],
          low: d.lows[i],
          close: d.closes[i],
          volume: d.volumes[i],
        });
      }
      setChartData(mapped);
    }
  }, [activeSymbol, runStatus]);

  const synthesis = runStatus?.results[activeSymbol];
  const logicMap = synthesis?.logic_map || [];
  const criticAgent = runStatus?.agents[activeSymbol]?.["critic"];
  const criticChallenges = (criticAgent?.data as any)?.challenges || [];

  // Generate signals based on logic map, anchoring them to the latest date
  const latestDate = chartData.length > 0 ? chartData[chartData.length - 1].time : "";
  const signals: AgentSignal[] = latestDate ? logicMap.map((lm) => ({
    agent: lm.agent,
    signal: lm.signal,
    date: latestDate,
  })) : [];

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Ticker Selector if multiple */}
      {runStatus && runStatus.symbols.length > 1 && (
        <div className="flex bg-[var(--color-war-border)] h-8 border-b border-[var(--color-war-border)] gap-px">
          {runStatus.symbols.map((sym) => (
            <button
              key={sym}
              onClick={() => setActiveSymbol(sym)}
              className={`px-6 h-full font-mono text-[10px] uppercase tracking-widest transition-colors ${
                activeSymbol === sym
                  ? "bg-[var(--color-war-text)] text-white"
                  : "bg-[var(--color-war-bg)] text-[var(--color-war-muted)] hover:bg-[#e8e4db]"
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      )}

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex w-full overflow-hidden bg-[var(--color-war-border)] gap-px">
        {/* LEFT PANEL (28%) */}
        <div className="w-[28%] bg-black h-full overflow-hidden">
          <IntelligenceFeed runId={runId} />
        </div>

        {/* CENTER PANEL (44%) */}
        <div className="w-[44%] bg-[var(--color-war-bg)] h-full overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ChartRoom 
              symbol={activeSymbol || "..."} 
              data={chartData} 
              signals={signals} 
              hoveredAgent={hoveredAgent} 
            />
          </div>
          <EvidenceTrail 
            logicMap={logicMap}
            criticChallenges={criticChallenges}
            hoveredAgent={hoveredAgent}
            onHoverAgent={setHoveredAgent}
          />
        </div>

        {/* RIGHT PANEL (28%) */}
        <div className="w-[28%] bg-[var(--color-war-bg)] h-full overflow-hidden">
          <VerdictPanel
            symbol={activeSymbol || "..."}
            synthesis={synthesis || null}
            agents={runStatus?.agents[activeSymbol] || {}}
          />
        </div>
      </div>
    </div>
  );
}
