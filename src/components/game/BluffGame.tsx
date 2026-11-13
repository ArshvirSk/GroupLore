"use client";

import { Icon } from "@/components/ui/Icon";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type BluffChoice = { id: string; text: string };
type RevealChoice = {
  id: string;
  text: string;
  isReal: boolean;
  authors: { playerId: string; name: string }[];
  votes: number;
  voters: { playerId: string; name: string }[];
};

type BluffReveal = {
  question: string;
  realAnswer: string;
  choices: RevealChoice[];
  exactMatches: { playerId: string; name: string }[];
  roundPoints: { playerId: string; name: string; points: number }[];
};

export type BluffView = {
  phase: "write" | "vote" | "reveal";
  round: number;
  rounds: number;
  question: string;
  submitted: number;
  total: number;
  youSubmitted?: boolean;
  writeMs?: number;
  choices?: BluffChoice[];
  myChoiceId?: string | null;
  myVote?: string | null;
  reveal?: BluffReveal | null;
};

export default function BluffGame({
  view,
  send,
}: {
  room: RoomView;
  view: BluffView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "write") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Write a bluff" icon="mask">
          {view.question}
        </PromptCard>

        <div className="party-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Make it sound convincing. The real answer is hidden among the fakes.
          </p>
          <AnswerInput
            autoFocus
            maxLength={120}
            placeholder="Your fake answer…"
            submitLabel="Submit bluff"
            disabled={view.youSubmitted}
            onSubmit={(value) => send("bluff", { value })}
          />
          <div className="mt-3 flex justify-between text-xs font-bold text-ink-soft">
            <span>
              {view.submitted}/{view.total} bluffs in
            </span>
            <span>{Math.ceil((view.writeMs || 0) / 1000)}s</span>
          </div>
        </div>
      </div>
    );
  }

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Which one is real?" icon="search" compact>
          {view.question}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Pick the real answer</span>
          <span>
            {view.submitted}/{view.total} voted
          </span>
        </div>

        <div className="grid gap-2">
          {(view.choices || []).map((choice) => {
            const mine = view.myChoiceId === choice.id;
            const selected = view.myVote === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={Boolean(view.myVote) || mine}
                onClick={() => send("vote", { choiceId: choice.id })}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left shadow-soft transition ${
                  selected
                    ? "border-grape"
                    : "border-transparent enabled:hover:border-lavender"
                } ${mine ? "opacity-50" : ""} disabled:cursor-default`}
              >
                <span className="flex-1 font-display text-base font-semibold text-ink">
                  {choice.text}
                </span>
                {mine && (
                  <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                    your bluff
                  </span>
                )}
                {selected && <Icon name="check" className="h-5 w-5" />}
              </button>
            );
          })}
        </div>

        {view.myVote && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Vote locked. Let&apos;s see who got fooled…
          </p>
        )}
      </div>
    );
  }

  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <div className="space-y-4">
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card bg-mint/40 p-6 text-center"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          The real answer
        </p>
        <p className="mt-2 font-display text-2xl font-semibold text-ink">
          {reveal.realAnswer}
        </p>
        <p className="mt-2 text-sm font-bold text-ink-soft">{reveal.question}</p>
      </motion.div>

      <div className="party-card space-y-3 p-5">
        {reveal.choices.map((choice) => (
          <div
            key={choice.id}
            className={`rounded-2xl border-2 px-4 py-3 ${
              choice.isReal
                ? "border-mint bg-mint/30"
                : "border-transparent bg-cream"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-base font-semibold text-ink">
                {choice.text}
              </p>
              <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                {choice.isReal
                  ? "real"
                  : choice.authors.map((author) => author.name).join(", ")}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-ink-soft">
              {choice.votes} vote{choice.votes === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

      {reveal.exactMatches.length > 0 && (
        <p className="text-center text-sm font-bold text-ink-soft">
          Knew the real answer:{" "}
          {reveal.exactMatches.map((entry) => entry.name).join(", ")}
        </p>
      )}

      {reveal.roundPoints.length > 0 && (
        <div className="party-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Points this round
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reveal.roundPoints.map((entry) => (
              <span
                key={entry.playerId}
                className="rounded-full bg-blush/60 px-3 py-1 text-sm font-bold text-[#B83232]"
              >
                {entry.name} +{entry.points}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
