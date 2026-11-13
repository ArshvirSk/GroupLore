"use client";

import AvatarBubble from "@/components/game/AvatarBubble";
import { Icon } from "@/components/ui/Icon";
import { motion, useReducedMotion } from "framer-motion";

export type LeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
  isWinner?: boolean;
};


export default function Leaderboard({
  entries,
  youId,
}: {
  entries: LeaderboardEntry[];
  youId?: string | null;
}) {
  const reduced = useReducedMotion();

  return (
    <ol className="space-y-2">
      {entries.map((entry, index) => (
        <motion.li
          key={entry.playerId}
          initial={reduced ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 ${
            entry.isWinner ? "border-honey shadow-pop" : "border-transparent shadow-soft"
          } ${entry.playerId === youId ? "ring-2 ring-grape/30" : ""}`}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? "bg-accent text-on-accent" : index === 1 ? "bg-primary-soft text-ink" : "bg-surface-2 text-muted"}`}>
            {index < 3 ? <Icon name="trophy" className="h-4 w-4" /> : index + 1}
          </span>
          <AvatarBubble name={entry.name} size="sm" />
          <span className="min-w-0 flex-1 truncate font-display font-semibold text-ink">
            {entry.name}
            {entry.playerId === youId ? " (you)" : ""}
          </span>
          <span className="font-display text-lg font-semibold text-grape">
            {entry.score}
          </span>
        </motion.li>
      ))}
    </ol>
  );
}
