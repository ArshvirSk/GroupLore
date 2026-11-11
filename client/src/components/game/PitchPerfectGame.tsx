"use client";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type PitchChoice = { id: string; text: string };
type PitchRevealChoice = PitchChoice & {
  playerId: string;
  name: string;
  votes: number;
  points: number;
};

export type PitchView =
  | {
      phase: "write";
      round: number;
      rounds: number;
      product: string;
      submitted: number;
      total: number;
      youSubmitted: boolean;
      writeMs: number;
      finalRound: boolean;
    }
  | {
      phase: "vote";
      round: number;
      rounds: number;
      product: string;
      choices: PitchChoice[];
      myChoiceId: string | null;
      myVote: string | null;
      submitted: number;
      total: number;
      finalRound: boolean;
    }
  | {
      phase: "reveal";
      round: number;
      rounds: number;
      reveal: {
        product: string;
        multiplier: number;
        choices: PitchRevealChoice[];
        roundPoints: { playerId: string; name: string; points: number }[];
      };
    };

export default function PitchPerfectGame({
  view,
  send,
}: {
  room: RoomView;
  view: PitchView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "write") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Sell this product" emoji="🦈">
          {view.product}
          {view.finalRound && (
            <span className="mt-2 block text-xs font-bold uppercase tracking-wide text-[#B8720A]">
              Final round · votes count double
            </span>
          )}
        </PromptCard>

        <div className="party-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
            One sentence. Make the room want it.
          </p>
          <AnswerInput
            autoFocus
            maxLength={140}
            placeholder="The tagline that sells it…"
            submitLabel="Pitch it"
            disabled={view.youSubmitted}
            onSubmit={(value) => send("pitch", { value })}
          />
          <div className="mt-3 flex justify-between text-xs font-bold text-ink-soft">
            <span>{view.submitted}/{view.total} pitches in</span>
            <span>{Math.ceil(view.writeMs / 1000)}s</span>
          </div>
        </div>
      </div>
    );
  }

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Which pitch wins?" emoji="🦈" compact>
          {view.product}
          {view.finalRound && (
            <span className="mt-2 block text-xs font-bold uppercase tracking-wide text-[#B8720A]">
              Final round · votes count double
            </span>
          )}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Pick another player&apos;s pitch</span>
          <span>{view.submitted}/{view.total} voted</span>
        </div>

        <div className="grid gap-2">
          {view.choices.map((choice) => {
            const mine = view.myChoiceId === choice.id;
            const selected = view.myVote === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={Boolean(view.myVote) || mine}
                onClick={() => send("vote", { choiceId: choice.id })}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left shadow-soft transition ${
                  selected ? "border-grape" : "border-transparent enabled:hover:border-lavender"
                } ${mine ? "opacity-50" : ""} disabled:cursor-default`}
              >
                <span className="flex-1 font-display text-base font-semibold text-ink">
                  {choice.text}
                </span>
                {mine && (
                  <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                    yours
                  </span>
                )}
                {selected && <span className="text-lg">✓</span>}
              </button>
            );
          })}
        </div>

        {view.myVote && (
          <p className="text-center text-sm font-bold text-ink-soft">Vote locked. Reveal coming…</p>
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
        className="party-card bg-honey/40 p-6 text-center"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">The winning pitch</p>
        <p className="mt-2 font-display text-2xl font-semibold text-ink">
          {reveal.choices[0]?.text || "No pitches this round"}
        </p>
        <p className="mt-2 text-sm font-bold text-ink-soft">
          {reveal.choices[0]?.name || "Nobody"} · {reveal.multiplier}× round
        </p>
      </motion.div>

      <div className="party-card space-y-3 p-5">
        {reveal.choices.map((choice) => (
          <div
            key={choice.id}
            className={`rounded-2xl border-2 px-4 py-3 ${
              choice.points > 0 ? "border-honey bg-honey/20" : "border-transparent bg-cream"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-base font-semibold text-ink">{choice.text}</p>
              <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                {choice.name}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-ink-soft">
              {choice.votes} vote{choice.votes === 1 ? "" : "s"} · +{choice.points}
            </p>
          </div>
        ))}
      </div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Points this round</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.roundPoints.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">Nobody scored.</p>
          ) : (
            reveal.roundPoints.map((entry) => (
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
    </div>
  );
}
