"use client";

import { Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import type { AgentStatus } from "@/lib/api";
import { agentDisplayName, formatConfidence, getSignalColor } from "@/lib/utils";
import SignalBadge from "./SignalBadge";

interface AgentCardProps {
  agentName: string;
  agentStatus: AgentStatus;
}

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case "running":
      return (
        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
      );
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-400" />;
    case "pending":
    default:
      return <Circle className="h-4 w-4 text-slate-500" />;
  }
}

function confidenceBarColor(signal: string | null): string {
  switch (signal) {
    case "BUY":
      return "bg-emerald-500";
    case "SELL":
      return "bg-red-500";
    case "HOLD":
      return "bg-amber-500";
    default:
      return "bg-slate-500";
  }
}

export default function AgentCard({ agentName, agentStatus }: AgentCardProps) {
  const isRunning = agentStatus.status === "running";
  const showDetails =
    agentStatus.status === "completed" || agentStatus.status === "failed";

  const borderClass = isRunning
    ? "border-indigo-500/50 animate-pulse"
    : "border-slate-700";

  const confidencePct =
    agentStatus.confidence !== null
      ? Math.round(agentStatus.confidence * 100)
      : 0;

  return (
    <div
      className={`bg-slate-800/50 border ${borderClass} rounded-xl p-4 transition-all duration-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-slate-200 text-sm">
          {agentDisplayName(agentName)}
        </span>
        <StatusIndicator status={agentStatus.status} />
      </div>

      {/* Details */}
      {showDetails && (
        <div className="space-y-2">
          <SignalBadge signal={agentStatus.signal} size="sm" />

          {/* Confidence bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Confidence</span>
              <span className={getSignalColor(agentStatus.signal)}>
                {formatConfidence(agentStatus.confidence)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full ${confidenceBarColor(agentStatus.signal)} transition-all duration-500`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          {/* Reasoning */}
          {agentStatus.reasoning && (
            <p
              className="text-slate-400 text-xs line-clamp-2"
              title={agentStatus.reasoning}
            >
              {agentStatus.reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
