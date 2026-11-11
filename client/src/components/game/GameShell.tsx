"use client";

import ConnectionBanner from "@/components/game/ConnectionBanner";
import { TimerBar } from "@/components/ui";
import type { RoomStatus } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export default function GameShell({
  title,
  emoji,
  round,
  totalRounds,
  endsAt,
  serverNow,
  status,
  onExit,
  exitLabel = "Leave",
  children,
}: {
  title: string;
  emoji?: string;
  accent?: string;
  round?: number;
  totalRounds?: number;
  endsAt?: number | null;
  serverNow?: number;
  status?: RoomStatus;
  onExit?: () => void;
  exitLabel?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-10 pt-5 sm:px-6">
        <header className="rounded-[20px] border border-border bg-surface px-4 py-3 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-xl" aria-hidden>
                {emoji || "🎲"}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">
                  {typeof round === "number" && totalRounds
                    ? `Round ${round} of ${totalRounds}`
                    : "Game night"}
                </p>
                <h1 className="truncate font-display text-xl font-semibold text-ink sm:text-2xl">
                  {title}
                </h1>
              </div>
            </div>
            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                className="min-h-11 rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {exitLabel}
              </button>
            ) : null}
          </div>
          {endsAt && typeof serverNow === "number" ? (
            <div className="mt-3">
              <TimerBar endsAt={endsAt} serverNow={serverNow} />
            </div>
          ) : null}
        </header>

        {status ? <div className="mt-3"><ConnectionBanner status={status} /></div> : null}

        {reduced ? (
          <div className="mt-5 flex-1">{children}</div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="mt-5 flex-1"
          >
            {children}
          </motion.div>
        )}
      </div>
    </main>
  );
}
