"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export default function PromptCard({
  children,
  kicker,
  icon,
  compact = false,
}: {
  children: ReactNode;
  kicker?: string;
  icon?: IconName;
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
      <Icon name="sparkles" className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-primary/20" />
      {kicker && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {kicker}
        </p>
      )}
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-ink/15 bg-surface-2/70 text-ink"><Icon name={icon} className="h-6 w-6" /></div>}
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
