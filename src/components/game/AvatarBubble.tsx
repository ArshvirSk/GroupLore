"use client";

import { Icon } from "@/components/ui/Icon";

const PALETTE = [
  "bg-[#bfa0f4]",
  "bg-[#f29bcb]",
  "bg-[#8edceb]",
  "bg-[#d7f45b]",
  "bg-[#ffc857]",
  "bg-[#eadcfb]",
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const SIZES = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
};

export default function AvatarBubble({
  name,
  src,
  size = "md",
  isHost = false,
  ready = false,
  connected = true,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  isHost?: boolean;
  ready?: boolean;
  connected?: boolean;
}) {
  const tint =
    PALETTE[
      [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        PALETTE.length
    ];

  return (
    <div className={`relative inline-flex ${connected ? "" : "opacity-50"}`}>
      <div
        className={`${SIZES[size]} flex items-center justify-center overflow-hidden rounded-full border border-ink/20 ${tint} font-display font-semibold text-ink shadow-soft`}
      >
        {src ? (
          // Remote avatars are user-provided; next/image would need a domain list.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name) || "?"
        )}
      </div>
      {isHost && (
        <span
          className="absolute -top-1.5 -right-1.5 rounded-full bg-honey px-1 text-[10px] leading-4 shadow"
          title="Host"
        >
          <Icon name="crown" className="h-3 w-3" />
        </span>
      )}
      {ready && !isHost && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-lime text-[10px] font-bold text-ink">
          <Icon name="check" className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}
