"use client";

import { Icon } from "@/components/ui/Icon";
import { motion } from "framer-motion";

interface AvatarBubbleProps {
  name: string;
  avatarUrl?: string;
  isHost?: boolean;
  isReady?: boolean;
  isActive?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-14 h-14 text-lg",
};

export default function AvatarBubble({
  name,
  avatarUrl,
  isHost,
  isReady,
  isActive,
  size = "md",
}: AvatarBubbleProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5"
      animate={isActive ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <div className="relative">
        <div
          className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold tracking-tight relative overflow-hidden ${
            isReady
              ? "ring-2 ring-success ring-offset-2 ring-offset-bg-primary"
              : ""
          }`}
          style={{
            background: avatarUrl
              ? `url(${avatarUrl}) center/cover`
              : "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-hover)",
          }}
        >
          {!avatarUrl && (
            <span className="text-text-secondary">{initials}</span>
          )}
        </div>

        {/* Host indicator */}
        {isHost && (
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <Icon name="crown" className="h-2.5 w-2.5" />
          </motion.div>
        )}
      </div>

      {/* Name */}
      <span
        className={`text-center leading-tight max-w-[80px] truncate ${
          size === "sm" ? "text-[10px]" : "text-xs"
        } ${isReady ? "text-success" : "text-text-secondary"}`}
      >
        {name}
      </span>
    </motion.div>
  );
}
