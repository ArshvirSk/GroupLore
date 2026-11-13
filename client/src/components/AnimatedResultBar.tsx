"use client";

import { EmojiIcon } from "@/components/ui/Icon";
import { motion } from "framer-motion";

interface AnimatedResultBarProps {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
  emoji?: string;
  delay?: number;
}

export default function AnimatedResultBar({
  label,
  value,
  maxValue,
  color = "var(--primary)",
  emoji,
  delay = 0,
}: AnimatedResultBarProps) {
  const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <motion.div
      className="mb-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium tracking-tight">
          {emoji && <EmojiIcon value={emoji} className="mr-1.5 inline h-4 w-4" />}
          {label}
        </span>
        <span className="text-sm text-text-secondary font-mono">
          {value} <span className="text-text-muted">/ {maxValue}</span>
        </span>
      </div>
      <div className="h-2 bg-bg-elevated rounded-full overflow-hidden border border-border">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{
            duration: 0.8,
            delay: delay + 0.2,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      </div>
    </motion.div>
  );
}
