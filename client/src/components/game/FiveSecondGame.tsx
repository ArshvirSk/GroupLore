"use client";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type FiveReveal = {
  playerId: string;
  name: string;
  prompt: string;
  answer: string | null;
  success: boolean;
  nailed: number;
  missed: number;
  reason: string;
};

export type FiveSecondView = {
  phase: "answer" | "judge" | "reveal";
  round: number;
  rounds: number;
  prompt: string;
  currentPlayerId: string;
  currentPlayerName: string;
  youAreAnswering: boolean;
  answerMs: number;
  judgeMs: number;
  votersTotal: number;
  votesSubmitted: number;
  myVote: "nailed" | "missed" | null;
  answer?: string | null;
  canJudge?: boolean;
  reveal?: FiveReveal | null;
};

export default function FiveSecondGame({
  view,
  send,
}: {
  room: RoomView;
  view: FiveSecondView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "answer") {
    return (
      <div className="space-y-4">
        <PromptCard
          kicker={
            view.youAreAnswering
              ? "You are on the clock"
              : `${view.currentPlayerName} is on the clock`
          }
          emoji="⚡"
        >
          {view.prompt}
        </PromptCard>

        {view.youAreAnswering ? (
          <div className="party-card p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
              Quick — type one answer before the ring runs out
            </p>
            <AnswerInput
              autoFocus
              maxLength={160}
              placeholder="Type fast…"
              submitLabel="Lock it in"
              onSubmit={(value) => send("answer", { value })}
            />
            <p className="mt-3 text-center text-sm font-bold text-coral">
              {Math.ceil(view.answerMs / 1000)} seconds. Go.
            </p>
          </div>
        ) : (
          <div className="party-card p-8 text-center">
            <p className="text-4xl">👀</p>
            <p className="mt-2 font-display text-xl font-semibold text-ink">
              No helping from the crowd.
            </p>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              {view.currentPlayerName} has {Math.ceil(view.answerMs / 1000)} seconds.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (view.phase === "judge") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Did it count?" emoji="🤔" compact>
          {view.prompt}
        </PromptCard>

        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl bg-white p-6 text-center shadow-soft"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
            {view.currentPlayerName}&apos;s answer
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink">
            {view.answer || "…"}
          </p>
        </motion.div>

        {view.canJudge ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={Boolean(view.myVote)}
              onClick={() => send("judge", { value: "nailed" })}
              className={`min-h-16 rounded-2xl border-2 px-4 font-display text-base font-semibold shadow-soft transition ${
                view.myVote === "nailed"
                  ? "border-[#20B49A] bg-mint text-[#0F7F6C]"
                  : "border-transparent bg-white text-ink enabled:hover:border-mint"
              } disabled:opacity-50`}
            >
              Nailed it ✅
            </button>
            <button
              type="button"
              disabled={Boolean(view.myVote)}
              onClick={() => send("judge", { value: "missed" })}
              className={`min-h-16 rounded-2xl border-2 px-4 font-display text-base font-semibold shadow-soft transition ${
                view.myVote === "missed"
                  ? "border-coral bg-blush text-[#B83232]"
                  : "border-transparent bg-white text-ink enabled:hover:border-blush"
              } disabled:opacity-50`}
            >
              Not quite ❌
            </button>
          </div>
        ) : (
          <p className="text-center text-sm font-bold text-ink-soft">
            Your answer is in. Let the group decide.
          </p>
        )}

        <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
          {view.votesSubmitted}/{view.votersTotal} judges voted
        </p>
      </div>
    );
  }

  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <div className="space-y-4">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`party-card p-6 text-center ${
          reveal.success ? "bg-mint/50" : "bg-coral/15"
        }`}
      >
        <p className="text-4xl">{reveal.success ? "⚡" : "💨"}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.reason === "timeout"
            ? "Time ran out"
            : reveal.reason === "left"
              ? "Player left"
              : reveal.success
                ? `${reveal.name} nailed it`
                : `${reveal.name} missed`}
        </p>
        <p className="mt-1 font-display text-2xl font-semibold text-ink">
          {reveal.answer || "No answer"}
        </p>
        <p className="mt-2 text-sm font-bold text-ink-soft">
          {reveal.success
            ? `${reveal.name} scored +1`
            : "No point this turn"}
        </p>
      </motion.div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          {reveal.prompt}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-mint/50 px-3 py-3">
            <p className="font-display text-2xl font-semibold text-[#0F7F6C]">
              {reveal.nailed}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#0F7F6C]">
              nailed it
            </p>
          </div>
          <div className="rounded-2xl bg-blush/60 px-3 py-3">
            <p className="font-display text-2xl font-semibold text-[#B83232]">
              {reveal.missed}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#B83232]">
              not quite
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
