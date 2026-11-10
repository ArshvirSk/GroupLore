"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export default function PromptCard({
  children,
  kicker,
  emoji,
  compact = false,
}: {
  children: ReactNode;
  kicker?: string;
  emoji?: string;
  compact?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.section
      className={`party-card relative overflow-hidden text-center ${
        compact ? "px-5 py-5" : "px-5 py-8 sm:px-8 sm:py-10"
      }`}
      initial={reduced ? false : { opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-lavender/30 blur-2xl" />
      {kicker && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {kicker}
        </p>
      )}
      {emoji && <div className="mb-2 text-3xl">{emoji}</div>}
      <div
        className={`font-display font-semibold leading-tight text-ink ${
          compact ? "text-xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {children}
      </div>
    </motion.section>
  );
}
