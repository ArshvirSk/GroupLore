"use client";

import { Icon } from "@/components/ui/Icon";

import AvatarBubble from "@/components/game/AvatarBubble";
import type { ReactNode } from "react";

export default function VoteButton({
  name,
  avatarUrl,
  subtitle,
  selected = false,
  disabled = false,
  onClick,
  trailing,
}: {
  name: string;
  avatarUrl?: string | null;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition ${
        selected
          ? "border-grape shadow-pop"
          : "border-transparent shadow-soft hover:border-lavender"
      } ${disabled && !selected ? "opacity-50" : ""} ${
        disabled ? "cursor-default" : "active:scale-[0.99]"
      }`}
    >
      <AvatarBubble name={name} src={avatarUrl} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-base font-semibold text-ink">
          {name}
        </span>
        {subtitle && (
          <span className="block truncate text-xs font-semibold text-ink-soft">
            {subtitle}
          </span>
        )}
      </span>
      {trailing ?? (selected ? <Icon name="check" className="h-5 w-5" /> : null)}
    </button>
  );
}
