"use client";

import { Icon } from "@/components/ui/Icon";
import type { RoomView } from "@/stores/roomStore";
import { useState } from "react";

const REASONS = [
  { id: "harassment", label: "Harassment" },
  { id: "hate", label: "Hate speech" },
  { id: "sexual", label: "Sexual content" },
  { id: "spam", label: "Spam or flooding" },
  { id: "other", label: "Other" },
];

export default function ReportPlayer({
  room,
  act,
}: {
  room: RoomView;
  act: (action: string, data?: Record<string, unknown>) => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("harassment");

  const others = room.players.filter((player) => player.id !== room.you?.id);
  if (!room.you || others.length === 0) return null;

  const alreadyReported = targetId
    ? room.yourReports.includes(targetId)
    : false;
  const reportedNames = room.yourReports
    .map((id) => room.players.find((player) => player.id === id)?.name)
    .filter(Boolean);

  return (
    <details className="mb-4 rounded-2xl border border-border bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-muted [&::-webkit-details-marker]:hidden">
        <Icon name="flag" className="h-4 w-4" />
        Report a player
      </summary>
      <div className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-xs font-bold uppercase tracking-wide text-muted">
          Player
          <select
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-medium text-ink"
          >
            <option value="">Choose a player</option>
            {others.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold uppercase tracking-wide text-muted">
          Reason
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-medium text-ink"
          >
            {REASONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!targetId || alreadyReported}
          onClick={() => {
            if (targetId) act("report", { playerId: targetId, reason });
          }}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink disabled:bg-surface-2 disabled:text-muted"
        >
          {alreadyReported ? "Reported" : "Send report"}
        </button>
      </div>
      {reportedNames.length > 0 ? (
        <p
          role="status"
          className="border-t border-border px-4 py-2 text-xs font-semibold text-muted"
        >
          Reported this session: {reportedNames.join(", ")}
        </p>
      ) : null}
    </details>
  );
}
