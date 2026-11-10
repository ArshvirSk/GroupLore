"use client";

import type { RoomStatus } from "@/stores/roomStore";

const COPY: Partial<Record<RoomStatus, string>> = {
  connecting: "Connecting to the room…",
  joining: "Taking your seat…",
  reconnecting: "Connection lost — reconnecting. Your seat is held for 30s.",
};

export default function ConnectionBanner({ status }: { status: RoomStatus }) {
  const message = COPY[status];
  if (!message) return null;

  return (
    <div
      className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-lavender bg-white/80 px-4 py-2 text-center text-sm font-semibold text-ink-soft"
      role="status"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-grape" />
      {message}
    </div>
  );
}
