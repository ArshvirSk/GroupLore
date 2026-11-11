"use client";

import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type WouldReveal = {
  a: string;
  b: string;
  aVotes: number;
  bVotes: number;
  aPct: number;
  bPct: number;
  majority: "a" | "b" | null;
  minority: "a" | "b" | null;
  tie: boolean;
  noVotes: boolean;
  roundPoints: { playerId: string; name: string; points: number }[];
  voters: { playerId: string; name: string; value: "a" | "b" }[];
};

export type WouldYouRatherView = {
  phase: "vote" | "reveal";
  round: number;
  rounds: number;
  a: string;
  b: string;
  submitted: number;
  total: number;
  myVote: "a" | "b" | null;
  voteMs?: number;
  minorityMode?: boolean;
  reveal?: WouldReveal | null;
};

export default function WouldYouRatherGame({
  view,
  send,
}: {
  room: RoomView;
  view: WouldYouRatherView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Would you rather…" emoji="🔀">
          Pick the life you could actually live with.
        </PromptCard>

        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["a", view.a, "Option A", "bg-lavender/30"],
              ["b", view.b, "Option B", "bg-babyblue/40"],
            ] as const
          ).map(([value, text, label, tint]) => (
            <button
              key={value}
              type="button"
              disabled={Boolean(view.myVote)}
              onClick={() => send("vote", { value })}
              className={`min-h-40 rounded-3xl border-2 p-5 text-left shadow-soft transition ${tint} ${
                view.myVote === value
                  ? "border-grape"
                  : "border-transparent enabled:hover:border-grape/50"
              } disabled:cursor-default`}
            >
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
                {label}
              </span>
              <span className="mt-3 block font-display text-xl font-semibold leading-tight text-ink">
                {text}
              </span>
              {view.myVote === value && (
                <span className="mt-4 block text-sm font-bold text-grape">
                  Locked in ✓
                </span>
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
          {view.submitted}/{view.total} voted
          {view.minorityMode ? " · minority gets 2" : " · majority gets 1"}
        </p>
      </div>
    );
  }

  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <div className="space-y-4">
      <PromptCard kicker="The group chose" emoji="🔀" compact>
        {reveal.tie
          ? "A perfect split."
          : reveal.majority === "a"
            ? reveal.a
            : reveal.b}
      </PromptCard>

      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card p-5"
      >
        <div className="flex items-end justify-between gap-3 text-sm font-bold">
          <span className="text-grape">{reveal.aPct}%</span>
          <span className="text-[#0369A1]">{reveal.bPct}%</span>
        </div>
        <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-ink/5">
          <div className="h-full bg-grape" style={{ width: `${reveal.aPct}%` }} />
          <div className="h-full flex-1 bg-sky" />
        </div>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-ink">
          <p className="rounded-xl bg-lavender/25 px-3 py-2">
            A: {reveal.a} · {reveal.aVotes}
          </p>
          <p className="rounded-xl bg-babyblue/35 px-3 py-2">
            B: {reveal.b} · {reveal.bVotes}
          </p>
        </div>
      </motion.div>

      {reveal.roundPoints.length > 0 && (
        <div className="party-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Points this round
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reveal.roundPoints.map((entry) => (
              <span
                key={entry.playerId}
                className="rounded-full bg-honey/50 px-3 py-1 text-sm font-bold text-[#8A5A00]"
              >
                {entry.name} +{entry.points}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          How the group split
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.voters.map((voter) => (
            <span
              key={voter.playerId}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                voter.value === "a"
                  ? "bg-lavender/40 text-grape"
                  : "bg-babyblue/60 text-[#0369A1]"
              }`}
            >
              {voter.name}: {voter.value === "a" ? "A" : "B"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
