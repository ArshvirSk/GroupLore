"use client";

import AnimatedResultBar from "@/components/game/AnimatedResultBar";

export type ReactionEntry = {
  playerId: string;
  name: string;
  ms: number;
  falseStart?: boolean;
  points?: number;
};

export default function ReactionBar({ entries }: { entries: ReactionEntry[] }) {
  const max = Math.max(1, ...entries.map((entry) => entry.ms));
  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <AnimatedResultBar
          key={entry.playerId}
          label={`${entry.name}${entry.falseStart ? " (false start)" : ""}`}
          value={entry.ms}
          max={max}
          index={index}
          suffix="ms"
        />
      ))}
    </div>
  );
}
