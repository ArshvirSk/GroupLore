"use client";

import { useTheme, type ThemeChoice } from "@/components/ThemeProvider";
import { motion, useReducedMotion } from "framer-motion";

const NEXT: Record<ThemeChoice, ThemeChoice> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const ICON: Record<ThemeChoice, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

const LABEL: Record<ThemeChoice, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const reduced = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}.`}
      title={`${LABEL[theme]} — click for ${LABEL[NEXT[theme]]}`}
      whileHover={reduced ? undefined : { x: -2, y: -2 }}
      whileTap={reduced ? undefined : { x: 3, y: 3 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border-[3px] border-border bg-surface px-3 font-display text-sm font-bold text-ink shadow-hard-sm ${className}`}
    >
      <span aria-hidden className="text-lg leading-none">
        {ICON[theme]}
      </span>
      <span className="hidden text-[12px] font-bold uppercase tracking-[0.08em] sm:inline">
        {theme}
      </span>
    </motion.button>
  );
}
