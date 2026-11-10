"use client";

import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type HotReveal = {
  prompt: string;
  agree: number;
  disagree: number;
  agreePct: number;
  disagreePct: number;
  minority: "agree" | "disagree" | null;
  majority: "agree" | "disagree" | null;
  tie: boolean;
  unanimous: boolean;
  noVotes: boolean;
  roundWinners: { playerId: string; name: string; points: number }[];
  voters: { playerId: string; name: string; vote: string }[];
};

export type HotTakesView = {
  phase: "vote" | "reveal";
  round: number;
  rounds: number;
  prompt: string;
  submitted: number;
  total: number;
  myVote: "agree" | "disagree" | null;
  voteMs?: number;
  reveal?: HotReveal | null;
};

export default function HotTakesGame({
  view,
  send,
}: {
  room: RoomView;
  view: HotTakesView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Hot take" emoji="🌶️">
          {view.prompt}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Agree or disagree?</span>
          <span>
            {view.submitted}/{view.total} voted
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={Boolean(view.myVote)}
            onClick={() => send("vote", { value: "agree" })}
            className={`min-h-32 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
              view.myVote === "agree"
                ? "border-[#20B49A] bg-mint/60"
                : "border-transparent bg-white enabled:hover:border-mint"
            } disabled:cursor-default`}
          >
            <span className="text-3xl">🔥</span>
            <span className="mt-2 block font-display text-2xl font-semibold text-ink">
              Agree
            </span>
            <span className="mt-1 block text-xs font-semibold text-ink-soft">
              This is a good take
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(view.myVote)}
            onClick={() => send("vote", { value: "disagree" })}
            className={`min-h-32 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
              view.myVote === "disagree"
                ? "border-coral bg-blush/60"
                : "border-transparent bg-white enabled:hover:border-blush"
            } disabled:cursor-default`}
          >
            <span className="text-3xl">🧊</span>
            <span className="mt-2 block font-display text-2xl font-semibold text-ink">
              Disagree
            </span>
            <span className="mt-1 block text-xs font-semibold text-ink-soft">
              Absolutely not
            </span>
          </button>
        </div>

        {view.myVote && (
          <p className="text-center text-sm font-bold text-ink-soft">
            You picked {view.myVote}. The minority gets the hottest points.
          </p>
        )}
      </div>
    );
  }

  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <div className="space-y-4">
      <PromptCard kicker="The room has spoken" emoji="🌶️" compact>
        {reveal.prompt}
      </PromptCard>

      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card p-5"
      >
        <div className="flex justify-between text-sm font-bold">
          <span className="text-[#0F7F6C]">Agree {reveal.agreePct}%</span>
          <span className="text-[#B83232]">Disagree {reveal.disagreePct}%</span>
        </div>
        <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-ink/5">
          <div
            className="h-full bg-mint transition-all"
            style={{ width: `${reveal.agreePct}%` }}
          />
          <div className="h-full flex-1 bg-coral transition-all" />
        </div>
        <p className="mt-3 text-center font-display text-xl font-semibold text-ink">
          {reveal.noVotes
            ? "No votes this round"
            : reveal.tie
              ? "Split down the middle — everyone scores"
              : reveal.unanimous
                ? "Unanimous — everyone scores"
                : `The ${reveal.minority} side gets the hot-take bonus`}
        </p>
        <p className="mt-1 text-center text-xs font-bold text-ink-soft">
          {reveal.noVotes
            ? "No points awarded."
            : reveal.tie || reveal.unanimous
              ? "+1 for everyone who voted"
              : "Minority +2 · Majority +1"}
        </p>
      </motion.div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Round points
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.roundWinners.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">Nobody scored.</p>
          ) : (
            reveal.roundWinners.map((entry) => (
              <span
                key={entry.playerId}
                className="rounded-full bg-blush/60 px-3 py-1 text-sm font-bold text-[#B83232]"
              >
                {entry.name} +{entry.points}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          How the room voted
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.voters.map((voter) => (
            <span
              key={voter.playerId}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                voter.vote === "agree"
                  ? "bg-mint/50 text-[#0F7F6C]"
                  : "bg-blush/60 text-[#B83232]"
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
