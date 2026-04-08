"use client";

import type { AgentStatus } from "@/lib/api";
import AgentCard from "./AgentCard";

interface AgentGridProps {
  agents: Record<string, Record<string, AgentStatus>>;
  symbol: string;
}

const AGENT_ORDER = [
  "data_ingestion",
  "technical",
  "fundamental",
  "sentiment",
  "ml_prediction",
  "risk",
  "synthesis",
];

export default function AgentGrid({ agents, symbol }: AgentGridProps) {
  const symbolAgents = agents[symbol] ?? {};

  const orderedAgents = AGENT_ORDER.filter(
    (name) => symbolAgents[name] !== undefined
  );

  return (
    <div>
      <h3 className="text-slate-400 text-sm uppercase tracking-wider mb-3">
        Agent Pipeline — {symbol}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {orderedAgents.map((agentName) => (
          <AgentCard
            key={agentName}
            agentName={agentName}
            agentStatus={symbolAgents[agentName]}
          />
        ))}
      </div>
    </div>
  );
}
