"use client";

import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type OverratedReveal = {
  prompt: { id: string; text: string };
  overrated: number;
  underrated: number;
  overPct: number;
  underPct: number;
  majority: "overrated" | "underrated" | null;
  tie: boolean;
  noVotes: boolean;
  voteCount: number;
  roundWinners: { playerId: string; name: string }[];
  voters: { playerId: string; name: string; vote: string }[];
};

export type OverratedView = {
  phase: "vote" | "reveal";
  round: number;
  rounds: number;
  prompt: string;
  submitted: number;
  total: number;
  myVote: "overrated" | "underrated" | null;
  voteMs?: number;
  reveal?: OverratedReveal | null;
};

export default function OverratedGame({
  view,
  send,
}: {
  room: RoomView;
  view: OverratedView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Overrated or underrated?" emoji="⚖️">
          {view.prompt}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Pick a side</span>
          <span>
            {view.submitted}/{view.total} voted
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={Boolean(view.myVote)}
            onClick={() => send("vote", { value: "overrated" })}
            className={`min-h-28 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
              view.myVote === "overrated"
                ? "border-coral bg-blush/70"
                : "border-transparent bg-white enabled:hover:border-blush"
            } disabled:cursor-default`}
          >
            <span className="text-3xl">📉</span>
            <span className="mt-2 block font-display text-xl font-semibold text-ink">
              Overrated
            </span>
            <span className="mt-1 block text-xs font-semibold text-ink-soft">
              Everyone talks it up
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(view.myVote)}
            onClick={() => send("vote", { value: "underrated" })}
            className={`min-h-28 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
              view.myVote === "underrated"
                ? "border-sky bg-babyblue/70"
                : "border-transparent bg-white enabled:hover:border-babyblue"
            } disabled:cursor-default`}
          >
            <span className="text-3xl">📈</span>
            <span className="mt-2 block font-display text-xl font-semibold text-ink">
              Underrated
            </span>
            <span className="mt-1 block text-xs font-semibold text-ink-soft">
              Deserves more credit
            </span>
          </button>
        </div>

        {view.myVote && (
          <p className="text-center text-sm font-bold text-ink-soft">
            You picked {view.myVote}. Waiting for the group…
          </p>
        )}

        <p className="text-center text-xs font-semibold text-ink-soft">
          The majority takes a point. Ties give everyone who voted a point.
        </p>
      </div>
    );
  }

  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <div className="space-y-4">
      <PromptCard kicker="The verdict" emoji="⚖️" compact>
        {reveal.prompt.text}
      </PromptCard>

      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card p-5"
      >
        <div className="flex items-end justify-between text-sm font-bold">
          <span className="text-[#B83232]">Overrated {reveal.overPct}%</span>
          <span className="text-[#0369A1]">Underrated {reveal.underPct}%</span>
        </div>
        <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-ink/5">
          <div
            className="h-full bg-coral transition-all"
            style={{ width: `${reveal.overPct}%` }}
          />
          <div
            className="h-full flex-1 bg-sky transition-all"
          />
        </div>
        <p className="mt-3 text-center font-display text-xl font-semibold text-ink">
          {reveal.noVotes
            ? "No votes this round"
            : reveal.tie
              ? "Split decision — everyone scores"
              : `${reveal.majority === "overrated" ? "Overrated" : "Underrated"} wins`}
        </p>
      </motion.div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Who scored
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.roundWinners.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">Nobody this round.</p>
          ) : (
            reveal.roundWinners.map((entry) => (
              <span
                key={entry.playerId}
                className="rounded-full bg-mint/60 px-3 py-1 text-sm font-bold text-[#0F7F6C]"
              >
                {entry.name} +1
              </span>
            ))
          )}
        </div>
      </div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          How the group voted
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.voters.map((voter) => (
            <span
              key={voter.playerId}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                voter.vote === "overrated"
                  ? "bg-blush/60 text-[#B83232]"
                  : "bg-babyblue/70 text-[#0369A1]"
              }`}
            >
              {voter.name}: {voter.vote}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
