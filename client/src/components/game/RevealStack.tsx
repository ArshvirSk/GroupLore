"use client";

import { motion, useReducedMotion } from "framer-motion";

export type RevealGroup = {
  answer: string;
  count: number;
  names: string[];
  tier?: string;
  points?: number;
};

export default function RevealStack({ groups }: { groups: RevealGroup[] }) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...groups.map((group) => group.count));

  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <motion.div
          key={`${group.answer}-${index}`}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08 }}
          className="rounded-2xl bg-white p-4 shadow-soft"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">
              {group.answer}
            </p>
            <span className="rounded-full bg-lavender/40 px-3 py-1 text-sm font-bold text-ink">
              ×{group.count}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {Array.from({ length: max }).map((_, dot) => (
              <span
                key={dot}
                className={`h-2 flex-1 rounded-full ${
                  dot < group.count ? "bg-grape" : "bg-ink/5"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 truncate text-xs font-semibold text-ink-soft">
            {group.names.join(", ")}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
