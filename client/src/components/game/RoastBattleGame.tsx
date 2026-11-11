"use client";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type RoastAssignment = {
  slotId: string;
  prompt: string;
  submitted: boolean;
};

type RoastRevealEntry = {
  id: string;
  text: string;
  forfeited: boolean;
  playerId: string;
  name: string;
  votes: number;
  points: number;
};

type RoastMatchupReveal = {
  id: string;
  prompt: string;
  entries: RoastRevealEntry[];
  voters: number;
};

type RoastRoundPoint = { playerId: string; name: string; points: number };

export type RoastView =
  | {
      phase: "write";
      round: number;
      rounds: number;
      assignments: RoastAssignment[];
      submitted: number;
      total: number;
      writeMs: number;
    }
  | {
      phase: "duel";
      round: number;
      rounds: number;
      index: number;
      total: number;
      matchup: { prompt: string; answers: { id: string; text: string }[] };
      isAuthor: boolean;
      canVote: boolean;
      myVote: string | null;
      submitted: number;
      totalVoters: number;
    }
  | {
      phase: "reveal";
      round: number;
      rounds: number;
      reveal: {
        matchups: RoastMatchupReveal[];
        roundPoints: RoastRoundPoint[];
      };
    };

export default function RoastBattleGame({
  view,
  send,
}: {
  room: RoomView;
  view: RoastView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "write") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Write your roast" emoji="🔥">
          Answer the prompt you were dealt. Keep it sharp and under 80 characters.
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>{view.assignments.length === 1 ? "Your prompt" : "Your two prompts"}</span>
          <span>
            {view.submitted}/{view.total} answers in
          </span>
        </div>

        {view.assignments.map((assignment) => (
          <div key={assignment.slotId} className="party-card space-y-3 p-5">
            <p className="font-display text-lg font-semibold text-ink">
              {assignment.prompt}
            </p>
            {assignment.submitted ? (
              <p className="text-sm font-bold text-[#0F7F6C]">Answer locked in ✓</p>
            ) : (
              <AnswerInput
                maxLength={80}
                placeholder="Your sharpest answer…"
                submitLabel="Lock answer"
                onSubmit={(value) => send("answer", { slotId: assignment.slotId, value })}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  if (view.phase === "duel") {
    return (
      <div className="space-y-4">
        <PromptCard kicker={`Duel ${view.index} of ${view.total}`} emoji="🔥" compact>
          {view.matchup.prompt}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>{view.isAuthor ? "Your duel is up" : "Pick the better answer"}</span>
          <span>
            {view.submitted}/{view.totalVoters} voted
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {view.matchup.answers.map((answer) => {
            const selected = view.myVote === answer.id;
            const empty = !answer.text;
            return (
              <button
                key={answer.id}
                type="button"
                disabled={!view.canVote || Boolean(view.myVote) || empty}
                onClick={() => send("vote", { slotId: answer.id })}
                className={`min-h-28 rounded-3xl border-2 px-5 py-4 text-left shadow-soft transition ${
                  selected
                    ? "border-grape bg-lavender/40"
                    : "border-transparent bg-white enabled:hover:border-lavender"
                } disabled:cursor-default ${empty ? "opacity-50" : ""}`}
              >
                <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {empty ? "Forfeit" : "Answer"}
                </span>
                <span className="mt-2 block font-display text-lg font-semibold text-ink">
                  {answer.text || "No answer submitted"}
                </span>
                {selected && <span className="mt-2 block text-sm font-bold text-grape">Your vote ✓</span>}
              </button>
            );
          })}
        </div>

        {view.isAuthor && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Authors sit this vote out. Let the room decide.
          </p>
        )}
        {view.myVote && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Vote locked. Next duel loading…
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
        className="party-card bg-honey/30 p-6 text-center"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          Round {view.round} results
        </p>
        <p className="mt-1 font-display text-2xl font-semibold text-ink">
          The room has spoken
        </p>
      </motion.div>

      {reveal.matchups.map((matchup) => (
        <div key={matchup.id} className="party-card space-y-3 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {matchup.prompt}
          </p>
          {matchup.entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-2xl border-2 px-4 py-3 ${
                entry.points > 0 ? "border-mint bg-mint/25" : "border-transparent bg-cream"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-base font-semibold text-ink">{entry.text}</p>
                <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                  {entry.name}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-ink-soft">
                {entry.forfeited ? "Forfeit" : `${entry.votes} vote${entry.votes === 1 ? "" : "s"}`}
                {entry.points > 0 ? ` · +${entry.points}` : ""}
              </p>
            </div>
          ))}
        </div>
      ))}

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
