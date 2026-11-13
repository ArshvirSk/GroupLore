"use client";

import { EmojiIcon, Icon } from "@/components/ui/Icon";
import { motion } from "framer-motion";

interface GameCardProps {
  title: string;
  description: string;
  emoji: string;
  gradient?: string;
  selected?: boolean;
  onClick?: () => void;
}

export default function GameCard({
  title,
  description,
  emoji,
  selected,
  onClick,
}: GameCardProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 ${selected
          ? "bg-accent/10 border-accent/40 shadow-[0_0_24px_rgba(37,99,235,0.15)]"
          : "bg-bg-card border-border hover:border-border-hover hover:bg-bg-card-hover"
        }`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${selected ? "bg-accent/20" : "bg-bg-elevated"
            }`}
        >
          <EmojiIcon value={emoji} className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base tracking-tight">{title}</h3>
          <p className="text-text-secondary text-sm mt-0.5">{description}</p>
        </div>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 rounded-full bg-accent flex items-center justify-center"
          >
            <Icon name="check" className="h-4 w-4 text-on-accent" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}
