"use client";

import { Icon } from "@/components/ui/Icon";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type AvoidClue = { id: string; playerId: string; name: string; text: string };
type AvoidGuess = {
  playerId: string;
  name: string;
  value: string;
  correct: boolean;
};
type AvoidReveal = {
  target: string;
  describerId: string;
  describerName: string;
  winnerId: string | null;
  winnerName: string | null;
  clues: AvoidClue[];
  guesses: AvoidGuess[];
  reason: string;
};

export type AvoidView = {
  phase: "play" | "reveal";
  round: number;
  rounds: number;
  mode: string;
  isDescriber: boolean;
  describerName: string;
  options: string[];
  clues: AvoidClue[];
  guesses: AvoidGuess[];
  playMs: number;
  target?: string | null;
  banned?: string[];
  reveal?: AvoidReveal | null;
};

export default function AvoidTheAnswerGame({
  view,
  send,
}: {
  room: RoomView;
  view: AvoidView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "play") {
    return (
      <div className="space-y-4">
        {view.isDescriber ? (
          <>
            <PromptCard kicker="Describe this word" icon="ban">
              {view.target}
            </PromptCard>
            <div className="party-card border-coral/20 bg-blush/20 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B83232]">
                Banned words
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(view.banned || []).map((word) => (
                  <span
                    key={word}
                    className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#B83232] line-through decoration-2"
                  >
                    {word}
                  </span>
                ))}
              </div>
              <div className="mt-4">
                <AnswerInput
                  autoFocus
                  maxLength={140}
                  placeholder="Drop a clue…"
                  submitLabel="Send clue"
                  onSubmit={(value) => send("clue", { value })}
                />
              </div>
              <p className="mt-3 text-center text-xs font-semibold text-ink-soft">
                Keep going until someone guesses it.
              </p>
            </div>
          </>
        ) : (
          <>
            <PromptCard kicker={`${view.describerName} is describing`} icon="search">
              Which word are they avoiding?
            </PromptCard>
            <div className="grid gap-2 sm:grid-cols-2">
              {view.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => send("guess", { value: option })}
                  className="min-h-14 rounded-2xl border-2 border-transparent bg-white px-4 py-3 text-left font-display text-lg font-semibold text-ink shadow-soft transition hover:border-grape"
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="party-card p-5">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-ink-soft">
            <span>Clue feed</span>
            <span>
              {view.clues.length} clue{view.clues.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {view.clues.length === 0 ? (
              <p className="text-sm font-semibold text-ink-soft">
                No clues yet. The describer is thinking…
              </p>
            ) : (
              view.clues.map((clue, index) => (
                <motion.p
                  key={clue.id}
                  initial={reduced ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-2xl bg-cream px-3 py-2 text-sm font-semibold text-ink"
                >
                  {clue.text}
                </motion.p>
              ))
            )}
          </div>
          {view.guesses.length > 0 && (
            <div className="mt-4 border-t border-ink/5 pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Wrong guesses
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {view.guesses
                  .filter((guess) => !guess.correct)
                  .map((guess, index) => (
                    <span
                      key={`${guess.playerId}-${index}`}
                      className="rounded-full bg-blush/50 px-3 py-1 text-xs font-bold text-[#B83232]"
                    >
                      {guess.name}: {guess.value}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {view.isDescriber && (
          <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
            {Math.ceil(view.playMs / 1000)}s to get a correct guess
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
        className={`party-card p-6 text-center ${
          reveal.winnerId ? "bg-mint/40" : "bg-blush/40"
        }`}
      >
        <p className="text-4xl">{reveal.winnerId ? <Icon name="sparkles" className="mx-auto h-10 w-10" /> : <Icon name="clock" className="mx-auto h-10 w-10" />}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.winnerName
            ? `${reveal.winnerName} guessed it`
            : "Nobody got there"}
        </p>
        <p className="mt-1 font-display text-3xl font-semibold text-ink">
          {reveal.target}
        </p>
        <p className="mt-2 text-sm font-bold text-ink-soft">
          {reveal.describerName} was describing it.
        </p>
      </motion.div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Clues
        </p>
        <div className="mt-2 space-y-2">
          {reveal.clues.map((clue) => (
            <p
              key={clue.id}
              className="rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-ink"
            >
              {clue.text}
            </p>
          ))}
        </div>
      </div>

      <p className="text-center text-sm font-bold text-ink-soft">
        {reveal.winnerId
          ? `${reveal.winnerName} +2 · ${reveal.describerName} +1`
          : "No points this round."}
      </p>
    </div>
  );
}
