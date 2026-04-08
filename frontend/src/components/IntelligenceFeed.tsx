"use client";

import { useState, useEffect, useRef } from "react";
import * as api from "@/lib/api";

type AgentEvent = {
  id: string;
  timestamp: string;
  agent: string;
  status: "started" | "completed" | "failed";
  message: string;
  signal?: "BUY" | "SELL" | "HOLD";
  conflicts?: string[];
};

type FilterType = "ALL" | "CONFLICTS" | "SIGNALS" | "DATA";

// Typewriter Component
function TypewriterText({ text, speed = 40 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Reset if text changes
    setDisplayedText("");
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, speed]);

  return <span>{displayedText}</span>;
}

export default function IntelligenceFeed({ runId }: { runId: string }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [isHovering, setIsHovering] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const prevAgentsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const sseUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/stream/${runId}`;
    const source = new EventSource(sseUrl);

    source.addEventListener("status", (e) => {
      try {
        const raw = JSON.parse(e.data);
        const { agents } = raw;
        const newEvents: AgentEvent[] = [];

        for (const [key, agent] of Object.entries(agents as Record<string, any>)) {
          const prev = prevAgentsRef.current[key];
          
          if (!prev && agent.status === "pending") {
            continue; // Skip initial pending
          }

          if (prev?.status !== agent.status && agent.status) {
            let statusEnum: "started" | "completed" | "failed" = "started";
            let msg = `Agent initiated protocol: ${agent.agent_name}`;
            
            if (agent.status === "failed") {
              statusEnum = "failed";
              msg = agent.reasoning || "Critical failure encountered during processing.";
            } else if (agent.status === "completed") {
              statusEnum = "completed";
              msg = agent.reasoning || "Analysis criteria satisfied.";
            }
            
            // Only assign valid signal if completed
            let sig: "BUY" | "SELL" | "HOLD" | undefined;
            if (agent.status === "completed" && (agent.signal === "BUY" || agent.signal === "SELL" || agent.signal === "HOLD")) {
              sig = agent.signal;
            }

            newEvents.push({
              id: `${key}_${agent.status}_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
              agent: agent.agent_name.toUpperCase(),
              status: statusEnum,
              message: msg,
              signal: sig,
            });
          }
          prevAgentsRef.current[key] = { ...agent };
        }

        if (newEvents.length > 0) {
          setEvents((current) => [...current, ...newEvents]);
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    });

    source.addEventListener("done", () => {
      source.close();
    });

    return () => source.close();
  }, [runId]);

  useEffect(() => {
    if (!isHovering && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, isHovering]);

  const filteredEvents = events.filter((e) => {
    if (filter === "ALL") return true;
    if (filter === "CONFLICTS") return e.status === "failed" || e.conflicts && e.conflicts.length > 0;
    if (filter === "SIGNALS") return !!e.signal;
    if (filter === "DATA") return e.status === "started";
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-[#050505] font-mono border-r border-[var(--color-war-border)]">
      {/* Filter Bar */}
      <div className="flex bg-[var(--color-war-bg)] border-b border-[var(--color-war-border)] h-[40px] items-center px-4 gap-4 shrimp-0">
        {(["ALL", "CONFLICTS", "SIGNALS", "DATA"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs uppercase tracking-widest px-2 py-1 transition-colors ${
              filter === f 
                ? "bg-[var(--color-war-text)] text-[var(--color-war-bg)]" 
                : "text-[var(--color-war-muted)] hover:text-[var(--color-war-text)] hover:bg-[#e8e4db]"
            }`}
          >
            [{f}]
          </button>
        ))}
      </div>

      {/* Log Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--color-war-bg)]"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {events.length === 0 && (
          <div className="text-xs text-[var(--color-war-muted)] uppercase tracking-widest">
            Establishing connection...
          </div>
        )}
        
        {filteredEvents.map((evt) => {
          const isFailed = evt.status === "failed";
          
          return (
            <div 
              key={evt.id} 
              className={`flex items-start gap-4 text-xs ${isFailed ? "bg-[var(--color-war-sell)]/10 p-2 border border-[var(--color-war-sell)] animate-pulse" : ""}`}
            >
              <span className="w-20 shrink-0 text-[var(--color-war-muted)] pt-[2px]">
                {evt.timestamp}
              </span>
              <div className="flex-1 break-words">
                <span className={`font-bold mr-2 uppercase ${isFailed ? "text-[var(--color-war-sell)]" : "text-amber-700"}`}>
                  [{evt.agent}]
                </span>
                
                <span className={isFailed ? "text-[var(--color-war-sell)] font-bold" : "text-[var(--color-war-text)]"}>
                  <TypewriterText text={evt.message} speed={40} />
                </span>

                {evt.signal && (
                  <span className={`ml-3 px-1 border font-bold ${
                    evt.signal === "BUY" ? "text-emerald-700 border-emerald-700" 
                    : evt.signal === "SELL" ? "text-red-700 border-red-700"
                    : "text-amber-700 border-amber-700"
                  }`}>
                    {evt.signal}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
