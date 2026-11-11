"use client";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type AcronymChoice = { id: string; text: string };
type AcronymRevealChoice = AcronymChoice & {
  playerId: string;
  name: string;
  votes: number;
  points: number;
};

export type AcronymView =
  | {
      phase: "write";
      round: number;
      rounds: number;
      letters: string[];
      topic: string | null;
      submitted: number;
      total: number;
      youSubmitted: boolean;
      writeMs: number;
    }
  | {
      phase: "vote";
      round: number;
      rounds: number;
      letters: string[];
      topic: string | null;
      choices: AcronymChoice[];
      myChoiceId: string | null;
      myVote: string | null;
      submitted: number;
      total: number;
    }
  | {
      phase: "reveal";
      round: number;
      rounds: number;
      reveal: {
        acronym: string;
        topic: string | null;
        choices: AcronymRevealChoice[];
        roundPoints: { playerId: string; name: string; points: number }[];
      };
    };

export default function AcronymWarsGame({
  view,
  send,
}: {
  room: RoomView;
  view: AcronymView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "write") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Expand the acronym" emoji="🔤">
          <span className="block text-5xl font-black tracking-[0.24em] text-grape">
            {view.letters.join("")}
          </span>
          {view.topic && <span className="mt-3 block text-sm text-ink-soft">{view.topic}</span>}
        </PromptCard>

        <div className="party-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
            One word per letter, in order. Punctuation is ignored.
          </p>
          <AnswerInput
            autoFocus
            maxLength={100}
            placeholder={`${view.letters[0]}… ${view.letters[1]}…`}
            submitLabel="Submit acronym"
            disabled={view.youSubmitted}
            onSubmit={(value) => send("answer", { value })}
          />
          <div className="mt-3 flex justify-between text-xs font-bold text-ink-soft">
            <span>{view.submitted}/{view.total} acronyms in</span>
            <span>{Math.ceil(view.writeMs / 1000)}s</span>
          </div>
        </div>
      </div>
    );
  }

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker={`Vote for the best ${view.letters.join("")}`} emoji="🔤" compact>
          {view.topic || "No topic — make it memorable."}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Pick another player&apos;s expansion</span>
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
        className="party-card bg-mint/40 p-6 text-center"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">The acronym was</p>
        <p className="mt-1 text-4xl font-black tracking-[0.24em] text-grape">{reveal.acronym}</p>
        {reveal.topic && <p className="mt-2 text-sm font-bold text-ink-soft">{reveal.topic}</p>}
      </motion.div>

      <div className="party-card space-y-3 p-5">
        {reveal.choices.map((choice) => (
          <div
            key={choice.id}
            className={`rounded-2xl border-2 px-4 py-3 ${
              choice.votes > 0 ? "border-mint bg-mint/25" : "border-transparent bg-cream"
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
    </div>
  );
}
