"use client";

import { motion } from "framer-motion";

interface PromptCardProps {
  text: string;
  source?: string;
  type?: string;
  emoji?: string;
}

export default function PromptCard({
  text,
  source,
  type,
  emoji,
}: PromptCardProps) {
  return (
    <motion.div
      className="relative max-w-lg mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <div className="bg-bg-elevated border border-border rounded-2xl p-8 text-center relative overflow-hidden">
        {/* Subtle accent line at top */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

        {emoji && (
          <span className="text-3xl mb-4 block opacity-80">{emoji}</span>
        )}

        <p className="text-xl md:text-2xl font-bold tracking-tight leading-snug">
          {text}
        </p>

        {source && <p className="text-text-muted text-sm mt-3">— {source}</p>}

        {type && (
          <span className="inline-block mt-3 px-3 py-1 text-xs rounded-full bg-accent-muted text-accent uppercase tracking-wider font-medium">
            {type}
          </span>
        )}
      </div>
    </motion.div>
  );
}
