"use client";

import { useEffect, useState } from "react";

/**
 * The shell remounts this component whenever the server publishes a new
 * deadline (`key={endsAt}`), so the initial duration comes straight from the
 * server's clock pair (endsAt - serverNow). The local interval only ticks down;
 * it never decides when a phase ends.
 */

export default function TimerRing({
  endsAt,
  serverNow,
  size = 56,
  className = "",
}: {
  endsAt: number | null;
  serverNow: number;
  size?: number;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(() =>
    endsAt && serverNow ? Math.max(0, endsAt - serverNow) : 0,
  );

  useEffect(() => {
    if (!endsAt) return;
    const timer = setInterval(() => {
      setRemaining((previous) => Math.max(0, previous - 250));
    }, 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (!endsAt) return null;

  const seconds = Math.ceil(remaining / 1000);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, remaining / Math.max(1, endsAt - serverNow));
  const urgent = seconds <= 5;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(43,33,64,0.1)"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={urgent ? "#FF6B6B" : "#8B5CF6"}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 200ms linear" }}
        />
      </svg>
      <span
        className={`absolute font-display text-sm font-semibold ${
          urgent ? "text-coral" : "text-ink"
        }`}
      >
        {seconds}
      </span>
    </div>
  );
}
