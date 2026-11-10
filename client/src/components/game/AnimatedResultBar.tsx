"use client";

import { motion, useReducedMotion } from "framer-motion";

const BAR_COLORS = [
  "bg-grape",
  "bg-sky",
  "bg-coral",
  "bg-[#F0A93B]",
  "bg-[#20B49A]",
  "bg-lime",
];

export default function AnimatedResultBar({
  label,
  value,
  max,
  index = 0,
  suffix,
  highlight = false,
}: {
  label: string;
  value: number;
  max: number;
  index?: number;
  suffix?: string;
  highlight?: boolean;
}) {
  const reduced = useReducedMotion();
  const width = max > 0 ? Math.max(4, (value / max) * 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span
          className={`truncate text-sm font-bold ${
            highlight ? "text-ink" : "text-ink-soft"
          }`}
        >
          {label}
        </span>
        <span className="font-display text-sm font-semibold text-ink">
          {value}
          {suffix ? <span className="text-ink-soft"> {suffix}</span> : null}
        </span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-ink/5">
        <motion.div
          className={`h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
        />
      </div>
    </div>
  );
}
