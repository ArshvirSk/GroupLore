"use client";

import ConnectionBanner from "@/components/game/ConnectionBanner";
import TimerRing from "@/components/game/TimerRing";
import type { RoomStatus } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const ACCENTS: Record<
  string,
  { background: string; button: string; soft: string; text: string }
> = {
  grape: {
    background:
      "radial-gradient(120% 90% at 15% 0%, #F3E8FF 0%, #FFF9F4 55%, #EAF7FF 100%)",
    button: "bg-grape hover:bg-[#7C4DEB]",
    soft: "bg-lavender/40",
    text: "text-grape",
  },
  honey: {
    background:
      "radial-gradient(120% 90% at 15% 0%, #FFF0C2 0%, #FFF9F4 55%, #FFE7D6 100%)",
    button: "bg-[#F0A93B] hover:bg-[#E39A2A]",
    soft: "bg-honey/40",
    text: "text-[#B8720A]",
  },
  teal: {
    background:
      "radial-gradient(120% 90% at 15% 0%, #D8FFF4 0%, #FFF9F4 55%, #E8E2FF 100%)",
    button: "bg-[#20B49A] hover:bg-[#189A84]",
    soft: "bg-mint/60",
    text: "text-[#0F7F6C]",
  },
  dark: {
    background:
      "radial-gradient(120% 90% at 15% 0%, #3B2459 0%, #2B2140 60%, #1C1530 100%)",
    button: "bg-grape hover:bg-[#7C4DEB]",
    soft: "bg-white/10",
    text: "text-lavender",
  },
  pink: {
    background:
      "radial-gradient(120% 90% at 15% 0%, #FFE1EF 0%, #FFF9F4 55%, #FFEFE3 100%)",
    button: "bg-coral hover:bg-[#F25555]",
    soft: "bg-blush/60",
    text: "text-coral",
  },
};

export default function GameShell({
  title,
  emoji,
  accent = "grape",
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
  const theme = ACCENTS[accent] || ACCENTS.grape;

  return (
    <main
      className="party-surface min-h-screen w-full overflow-x-hidden"
      style={{ background: theme.background }}
    >
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 pb-10 pt-5 sm:px-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {onExit && (
              <button
                onClick={onExit}
                className="flex min-h-11 items-center rounded-full border border-ink/10 bg-white/70 px-4 text-sm font-bold text-ink-soft transition hover:bg-white"
              >
                ← {exitLabel}
              </button>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
                {typeof round === "number" && totalRounds
                  ? `Round ${round} of ${totalRounds}`
                  : "GroupLore"}
              </p>
              <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">
                {emoji ? `${emoji} ` : ""}
                {title}
              </h1>
            </div>
          </div>
          {endsAt && typeof serverNow === "number" ? (
            <TimerRing
              key={endsAt}
              endsAt={endsAt}
              serverNow={serverNow}
              size={58}
            />
          ) : null}
        </header>

        {status && <ConnectionBanner status={status} />}

        {reduced ? (
          <div className="flex-1">{children}</div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1"
          >
            {children}
          </motion.div>
        )}
      </div>
    </main>
  );
}
