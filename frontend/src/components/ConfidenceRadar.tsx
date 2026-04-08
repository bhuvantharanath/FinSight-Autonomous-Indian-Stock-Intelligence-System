"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { AgentStatus } from "@/lib/api";
import { agentDisplayName } from "@/lib/utils";

interface ConfidenceRadarProps {
  agents: Record<string, Record<string, AgentStatus>>;
  symbol: string;
}

const RADAR_AGENTS = [
  "technical",
  "fundamental",
  "sentiment",
  "risk",
  "synthesis",
];

export default function ConfidenceRadar({
  agents,
  symbol,
}: ConfidenceRadarProps) {
  const symbolAgents = agents[symbol] ?? {};

  const data = RADAR_AGENTS.filter((name) => symbolAgents[name]).map(
    (name) => ({
      agent: agentDisplayName(name),
      confidence: Math.round(
        (symbolAgents[name].confidence ?? 0) * 100
      ),
    })
  );

  if (data.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">
        Agent Confidence Overview
      </h4>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="agent"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#475569", fontSize: 9 }}
            axisLine={false}
          />
          <Radar
            name="Confidence"
            dataKey="confidence"
            fill="rgba(99, 102, 241, 0.2)"
            stroke="#6366f1"
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
