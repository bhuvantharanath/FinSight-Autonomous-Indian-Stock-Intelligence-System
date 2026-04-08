"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, createSeriesMarkers } from "lightweight-charts";
import type { IChartApi, ISeriesApi } from "lightweight-charts";

export interface OHLCVPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AgentSignal {
  agent: string;
  signal: string;
  date: string;
}

export interface CandlestickChartProps {
  symbol: string;
  data: OHLCVPoint[];
  signals: AgentSignal[];
  hoveredAgent: string | null;
  backtest?: {
    asOfDate: string;
    predicted: string;
    actual: string;
  };
}

type TimeRange = "1M" | "3M" | "6M" | "1Y";

export default function CandlestickChart({
  symbol,
  data,
  signals,
  hoveredAgent,
  backtest,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<typeof CandlestickSeries> | null>(null);
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers> | null>(null);
  
  const [range, setRange] = useState<TimeRange>("6M");

  // Filter data based on range
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    const lastDate = new Date(data[data.length - 1].time);
    let monthsToSub = 0;
    if (range === "1M") monthsToSub = 1;
    if (range === "3M") monthsToSub = 3;
    if (range === "6M") monthsToSub = 6;
    if (range === "1Y") monthsToSub = 12;

    const startDate = new Date(lastDate);
    startDate.setMonth(startDate.getMonth() - monthsToSub);

    return data.filter((d) => new Date(d.time) >= startDate);
  }, [data, range]);

  useEffect(() => {
    if (!chartContainerRef.current || !filteredData.length) return;

    // Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#fdfdfc" },
        textColor: "#666",
      },
      grid: {
        vertLines: { color: "#e8e4db", style: 2 },
        horzLines: { color: "#e8e4db", style: 2 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#e8e4db",
      },
      timeScale: {
        borderColor: "#e8e4db",
        timeVisible: true,
      },
      autoSize: true,
    });
    chartRef.current = chart;

    // Add Candlestick Series (v5 API)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#1B4332",
      downColor: "#7F1D1D",
      borderVisible: false,
      wickUpColor: "#1B4332",
      wickDownColor: "#7F1D1D",
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Set Data
    const mappedCandles = filteredData.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candlestickSeries.setData(mappedCandles as any);

    // Add Volume Series as Overlay (v5 API)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "", // overlay
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const mappedVolume = filteredData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? "rgba(27, 67, 50, 0.4)" : "rgba(127, 29, 29, 0.4)",
    }));
    volumeSeries.setData(mappedVolume as any);

    // Apply markers
    applyMarkers(candlestickSeries);

    // Fit content
    chart.timeScale().fitContent();

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    
    // Initial sizing
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (markersRef.current) {
        try { markersRef.current.detach(); } catch { /* ignore */ }
        markersRef.current = null;
      }
      chart.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData]); 

  // Function to apply dynamic markers (v5 API - createSeriesMarkers)
  const applyMarkers = (series?: ISeriesApi<typeof CandlestickSeries>) => {
    const targetSeries = series || candlestickSeriesRef.current;
    if (!targetSeries) return;

    // Clean up previous markers
    if (markersRef.current) {
      try { markersRef.current.detach(); } catch { /* ignore */ }
      markersRef.current = null;
    }
    
    const markers: Array<{
      time: string;
      position: "belowBar" | "aboveBar";
      color: string;
      shape: "arrowUp" | "arrowDown";
      text: string;
      size: number;
    }> = [];

    // Agent Signals
    signals.forEach(s => {
      const dataPoint = filteredData.find(d => d.time === s.date);
      if (dataPoint) {
        markers.push({
          time: s.date,
          position: s.signal === "BUY" ? "belowBar" : "aboveBar",
          color: s.signal === "BUY" ? "#1B4332" : "#7F1D1D",
          shape: s.signal === "BUY" ? "arrowUp" : "arrowDown",
          text: `${s.agent}: ${s.signal}`,
          size: hoveredAgent === s.agent ? 2 : 1,
        });
      }
    });

    // Backtest marker
    if (backtest) {
      const dataPoint = filteredData.find(d => d.time === backtest.asOfDate);
      if (dataPoint) {
        markers.push({
          time: backtest.asOfDate,
          position: "aboveBar",
          color: "#ca8a04",
          shape: "arrowDown",
          text: `[BACKTEST] Predicted: ${backtest.predicted} | Actual: ${backtest.actual}`,
          size: 2,
        });
      }
    }
    
    // lightweight-charts requires markers to be sorted by time
    markers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    if (markers.length > 0) {
      markersRef.current = createSeriesMarkers(targetSeries, markers as any);
    }
  };

  // Re-apply markers when hoveredAgent changes
  useEffect(() => {
    applyMarkers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredAgent, signals, backtest]);

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* Overlay Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex bg-[var(--color-war-bg)] border border-[var(--color-war-border)] h-[32px] gap-px shadow-sm">
        {(["1M", "3M", "6M", "1Y"] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`font-mono text-[10px] uppercase tracking-widest px-4 transition-colors ${
              range === r
                ? "bg-[var(--color-war-text)] text-white"
                : "bg-transparent text-[var(--color-war-muted)] hover:bg-[#e8e4db]"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {!filteredData.length && (
        <div className="absolute inset-0 z-0 flex items-center justify-center font-mono text-sm text-[var(--color-war-muted)] uppercase tracking-widest bg-[#fdfdfc]">
          Synthesizing OHLCV data...
        </div>
      )}

      {/* Chart Canvas Container */}
      <div ref={chartContainerRef} className="flex-1 w-full h-full" />
    </div>
  );
}
