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
      whileHover={reduced ? undefined : { y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`inline-flex h-10 min-h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink transition-colors hover:bg-surface-2 ${className}`}
    >
      <span aria-hidden className="text-base leading-none">
        {ICON[theme]}
      </span>
    </motion.button>
  );
}
