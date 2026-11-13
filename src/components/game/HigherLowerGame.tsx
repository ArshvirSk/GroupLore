"use client";

import { Icon } from "@/components/ui/Icon";

import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

type Ranking = { playerId: string; name: string; score: number };

type HigherLowerReveal = {
  category: string;
  current: Ranking;
  next: Ranking;
  correctAnswer: "higher" | "lower";
  guesses: { playerId: string; name: string; value: "higher" | "lower" }[];
  roundPoints: { playerId: string; name: string; points: number }[];
};

export type HigherLowerView = {
  phase: "poll" | "guess" | "reveal";
  round: number;
  rounds: number;
  mode: string;
  category: string;
  submitted?: number;
  total?: number;
  youSubmitted?: boolean;
  myRatings?: Record<string, number> | null;
  pollMs?: number;
  currentName?: string;
  currentScore?: number;
  nextName?: string;
  myGuess?: "higher" | "lower" | null;
  reveal?: HigherLowerReveal | null;
};

export default function HigherLowerGame({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: HigherLowerView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "poll") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Rate the room" icon="trending">
          {view.category}
        </PromptCard>
        <RatingForm
          key={`${view.round}:${view.category}`}
          room={room}
          view={view}
          send={send}
        />
      </div>
    );
  }

  if (view.phase === "guess") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Make the call" icon="trending">
          Does <span className="text-grape">{view.nextName}</span> score higher or
          lower than <span className="text-grape">{view.currentName}</span>?
        </PromptCard>

        <div className="party-card p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {view.category}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink">
            {view.currentName}: {view.currentScore}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={Boolean(view.myGuess)}
            onClick={() => send("guess", { value: "higher" })}
            className={`min-h-24 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
              view.myGuess === "higher"
                ? "border-[#20B49A] bg-mint/50"
                : "border-transparent bg-white enabled:hover:border-mint"
            } disabled:cursor-default`}
          >
            <span className="text-3xl">⬆️</span>
            <span className="mt-2 block font-display text-xl font-semibold text-ink">
              Higher
            </span>
          </button>
          <button
            type="button"
            disabled={Boolean(view.myGuess)}
            onClick={() => send("guess", { value: "lower" })}
            className={`min-h-24 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
              view.myGuess === "lower"
                ? "border-coral bg-blush/70"
                : "border-transparent bg-white enabled:hover:border-blush"
            } disabled:cursor-default`}
          >
            <span className="text-3xl">⬇️</span>
            <span className="mt-2 block font-display text-xl font-semibold text-ink">
              Lower
            </span>
          </button>
        </div>

        <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
          {view.submitted}/{view.total} called it
        </p>
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
        className="party-card bg-mint/35 p-6 text-center"
      >
        <Icon name="chart" className="mx-auto h-10 w-10" />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.category}
        </p>
        <div className="mt-3 flex items-center justify-center gap-4 font-display text-xl font-semibold text-ink">
          <span>{reveal.current.name}</span>
          <span className="text-ink-soft">
            {reveal.current.score} → {reveal.next.score}
          </span>
          <span>{reveal.next.name}</span>
        </div>
        <p className="mt-2 text-sm font-bold text-ink-soft">
          The answer was {reveal.correctAnswer}.
        </p>
      </motion.div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          The calls
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.guesses.map((entry) => (
            <span
              key={entry.playerId}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                entry.value === reveal.correctAnswer
                  ? "bg-mint/60 text-[#0F7F6C]"
                  : "bg-blush/60 text-[#B83232]"
              }`}
            >
              {entry.name}: {entry.value}
            </span>
          ))}
        </div>
      </div>

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
    </div>
  );
}

function RatingForm({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: HigherLowerView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const opponents = room.players.filter((player) => player.id !== room.you?.id);
  const complete =
    opponents.length > 0 &&
    opponents.every((player) => Number.isFinite(ratings[player.id]));
  const submitted = Boolean(view.youSubmitted);

  return (
    <div className="party-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        Give every other player a score from 1 to 10
      </p>
      <div className="mt-4 space-y-3">
        {opponents.map((player) => (
          <label
            key={player.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3 py-2"
          >
            <span className="min-w-0 truncate font-display text-sm font-semibold text-ink">
              {player.name}
            </span>
            <select
              value={ratings[player.id] || ""}
              disabled={submitted}
              onChange={(event) =>
                setRatings((current) => ({
                  ...current,
                  [player.id]: Number(event.target.value),
                }))
              }
              className="min-h-10 rounded-xl border border-ink/10 bg-white px-2 text-sm font-bold text-ink outline-none focus:border-grape"
            >
              <option value="">–</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map(
                (value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ),
              )}
            </select>
          </label>
        ))}
      </div>

      {submitted ? (
        <p className="mt-4 text-center text-sm font-bold text-ink-soft">
          Ratings locked. Waiting for{" "}
          {Math.max(0, (view.total || 0) - (view.submitted || 0))} more.
        </p>
      ) : (
        <button
          type="button"
          disabled={!complete}
          onClick={() => send("ratings", { ratings })}
          className="mt-4 min-h-12 w-full rounded-2xl bg-grape px-5 font-display text-sm font-semibold text-white shadow-soft transition enabled:hover:bg-[#7C4DEB] disabled:opacity-40"
        >
          Lock in ratings
        </button>
      )}

      <p className="mt-3 text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
        {view.submitted}/{view.total} rated
      </p>
    </div>
  );
}
