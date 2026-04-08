"use client";

import { getSignalBg, getSignalColor } from "@/lib/utils";

interface SignalBadgeProps {
  signal: "BUY" | "SELL" | "HOLD" | null;
  size?: "sm" | "lg";
}

export default function SignalBadge({ signal, size = "sm" }: SignalBadgeProps) {
  const sizeClasses =
    size === "lg" ? "text-lg font-bold px-4 py-2" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${getSignalBg(signal)} ${getSignalColor(signal)} ${sizeClasses} transition-all duration-200`}
    >
      {signal ?? "—"}
    </span>
  );
}
