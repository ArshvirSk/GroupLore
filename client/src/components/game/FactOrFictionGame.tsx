"use client";

import { Icon } from "@/components/ui/Icon";

import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type FactResult = {
  playerId: string;
  name: string;
  answer: string;
  correct: boolean;
  points: number;
  streak: number;
};

export type FactView =
  | {
      phase: "question";
      round: number;
      rounds: number;
      statement: string;
      submitted: number;
      total: number;
      myAnswer: boolean | null;
      myStreak: number;
      alive: number | null;
      questionMs: number;
    }
  | {
      phase: "reveal";
      round: number;
      rounds: number;
      reveal: {
        statement: string;
        isTrue: boolean;
        explanation: string;
        results: FactResult[];
        eliminated: { playerId: string; name: string }[];
        roundPoints: { playerId: string; name: string; points: number }[];
        alive: string[] | null;
      };
    };

export default function FactOrFictionGame({
  view,
  send,
}: {
  room: RoomView;
  view: FactView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "question") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Fact or fiction?" icon="check">
          {view.statement}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>
            {view.alive === null ? `Question ${view.round} of ${view.rounds}` : `${view.alive} still standing`}
          </span>
          <span>{view.submitted}/{view.total} answered</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={view.myAnswer !== null}
            onClick={() => send("answer", { value: true })}
            className={`min-h-32 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
              view.myAnswer === true
                ? "border-[#20B49A] bg-mint/60"
                : "border-transparent bg-white enabled:hover:border-mint"
            } disabled:cursor-default`}
          >
            <Icon name="check" className="mx-auto h-8 w-8" />
            <span className="mt-2 block font-display text-2xl font-semibold text-ink">True</span>
            <span className="mt-1 block text-xs font-semibold text-ink-soft">That really happened</span>
          </button>

          <button
            type="button"
            disabled={view.myAnswer !== null}
            onClick={() => send("answer", { value: false })}
            className={`min-h-32 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
              view.myAnswer === false
                ? "border-coral bg-blush/60"
                : "border-transparent bg-white enabled:hover:border-blush"
            } disabled:cursor-default`}
          >
            <Icon name="close" className="mx-auto h-8 w-8" />
            <span className="mt-2 block font-display text-2xl font-semibold text-ink">Fiction</span>
            <span className="mt-1 block text-xs font-semibold text-ink-soft">Made up</span>
          </button>
        </div>

        <div className="flex items-center justify-between px-1 text-xs font-bold text-ink-soft">
          <span>Streak: {view.myStreak}</span>
          <span>{Math.ceil(view.questionMs / 1000)}s</span>
        </div>

        {view.myAnswer !== null && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Answer locked. Waiting for the reveal…
          </p>
        )}
      </div>
    );
  }

  const reveal = view.reveal;
  return (
    <div className="space-y-4">
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`party-card p-6 text-center ${
          reveal.isTrue ? "bg-mint/40" : "bg-blush/40"
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.isTrue ? "It's a fact" : "It's fiction"}
        </p>
        <p className="mt-2 font-display text-xl font-semibold text-ink">{reveal.statement}</p>
        <p className="mt-2 text-sm font-bold text-ink-soft">{reveal.explanation}</p>
      </motion.div>

      {reveal.alive && (
        <div className="party-card p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Still standing</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">
            {reveal.alive.join(", ") || "Nobody"}
          </p>
        </div>
      )}

      <div className="party-card space-y-2 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">This question</p>
        {reveal.results.map((result) => (
          <div
            key={result.playerId}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
              result.correct ? "bg-mint/25" : "bg-cream"
            }`}
          >
            <span className="text-sm font-semibold text-ink">{result.name}</span>
            <span className="text-xs font-bold text-ink-soft">
              {result.correct ? <Icon name="check" className="inline h-4 w-4" /> : <Icon name="close" className="inline h-4 w-4" />} {result.points > 0 ? `+${result.points}` : "0"} · streak {result.streak}
            </span>
          </div>
        ))}
      </div>

      {reveal.eliminated.length > 0 && (
        <p className="text-center text-sm font-bold text-[#B83232]">
          Eliminated: {reveal.eliminated.map((entry) => entry.name).join(", ")}
        </p>
      )}
    </div>
  );
}
