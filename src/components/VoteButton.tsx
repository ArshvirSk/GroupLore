"use client";

import { Icon } from "@/components/ui/Icon";
import { motion } from "framer-motion";

interface VoteButtonProps {
  label: string;
  variant?: "coral" | "blue" | "purple" | "default";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const variantStyles: Record<
  string,
  { bg: string; border: string; selectedBg: string }
> = {
  coral: {
    bg: "bg-bg-elevated",
    border: "border-border",
    selectedBg: "bg-danger/10 border-danger/40 text-danger",
  },
  blue: {
    bg: "bg-bg-elevated",
    border: "border-border",
    selectedBg: "bg-accent/10 border-accent/40 text-accent",
  },
  purple: {
    bg: "bg-bg-elevated",
    border: "border-border",
    selectedBg: "bg-primary-soft border-primary text-ink",
  },
  default: {
    bg: "bg-bg-elevated",
    border: "border-border",
    selectedBg: "bg-accent/10 border-accent/40 text-accent",
  },
};

export default function VoteButton({
  label,
  variant = "default",
  selected,
  disabled,
  onClick,
}: VoteButtonProps) {
  const style = variantStyles[variant] || variantStyles.default;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`relative px-8 py-4 rounded-full border text-base font-semibold tracking-tight transition-all duration-300 min-w-[160px] ${
        selected
          ? style.selectedBg
          : `${style.bg} ${style.border} hover:border-border-hover`
      } ${disabled && !selected ? "opacity-40 cursor-not-allowed" : ""}`}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      {label}

      {/* Selected check */}
      {selected && (
        <motion.span
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <Icon name="check" className="h-3 w-3 text-on-accent" />
        </motion.span>
      )}
    </motion.button>
  );
}
