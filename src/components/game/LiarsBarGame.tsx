"use client";

import { Icon } from "@/components/ui/Icon";

import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type LiarsReveal = {
  truth: string;
  lie: string;
  statement: string;
  wasLie: boolean;
  groupCorrect: boolean;
  truthVotes: number;
  lieVotes: number;
  liarId: string;
  liarName: string;
  voters: { playerId: string; name: string; value: "truth" | "lie" }[];
  roundPoints: { playerId: string; name: string; points: number }[];
};

export type LiarsView = {
  phase: "choose" | "vote" | "reveal";
  round: number;
  rounds: number;
  mode: string;
  isStoryteller: boolean;
  prompt?: { truth: string; lie: string };
  waiting?: boolean;
  statement?: string;
  submitted?: number;
  total?: number;
  myVote?: "truth" | "lie" | null;
  reveal?: LiarsReveal | null;
};

export default function LiarsBarGame({
  view,
  send,
}: {
  room: RoomView;
  view: LiarsView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "choose") {
    if (!view.isStoryteller) {
      return (
        <div className="party-card p-8 text-center">
          <Icon name="glass" className="mx-auto h-10 w-10" />
          <p className="mt-3 font-display text-xl font-semibold text-ink">
            The storyteller is choosing a statement…
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            You will vote on whether the statement is truth or a lie.
          </p>
        </div>
      );
    }

    const prompt = view.prompt;

    return (
      <div className="space-y-4">
        <PromptCard kicker="You are the storyteller" icon="glass">
          Pick one statement to present. The group votes on whether it is true.
        </PromptCard>

        <div className="grid gap-3 sm:grid-cols-2">
          {prompt &&
            (["truth", "lie"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => send("choose", { value: kind })}
                className="party-card min-h-40 p-5 text-left transition hover:border-grape/40"
              >
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
                  Option {kind === "truth" ? "A" : "B"}
                </span>
                <span className="mt-3 block font-display text-xl font-semibold leading-tight text-ink">
                  {kind === "truth" ? prompt.truth : prompt.lie}
                </span>
                <span className="mt-4 block text-xs font-bold text-grape">
                  Present this one →
                </span>
              </button>
            ))}
        </div>

        <p className="text-center text-xs font-semibold text-ink-soft">
          One of these is true. The longer they hesitate, the better.
        </p>
      </div>
    );
  }

  if (view.phase === "vote") {
    const isStoryteller = view.isStoryteller;
    return (
      <div className="space-y-4">
        <PromptCard kicker="Truth or lie?" icon="brain" compact>
          {view.statement}
        </PromptCard>

        {isStoryteller ? (
          <div className="party-card p-6 text-center">
            <Icon name="eye" className="mx-auto h-8 w-8" />
            <p className="mt-2 font-display text-lg font-semibold text-ink">
              Now let the group decide.
            </p>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              {view.submitted}/{view.total} votes are in.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={Boolean(view.myVote)}
                onClick={() => send("vote", { value: "truth" })}
                className={`min-h-28 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
                  view.myVote === "truth"
                    ? "border-mint bg-mint/50"
                    : "border-transparent bg-white enabled:hover:border-mint"
                } disabled:cursor-default`}
              >
                <Icon name="check" className="mx-auto h-8 w-8" />
                <span className="mt-2 block font-display text-xl font-semibold text-ink">
                  Truth
                </span>
                <span className="mt-1 block text-xs font-semibold text-ink-soft">
                  That actually happened
                </span>
              </button>
              <button
                type="button"
                disabled={Boolean(view.myVote)}
                onClick={() => send("vote", { value: "lie" })}
                className={`min-h-28 rounded-3xl border-2 px-4 py-5 text-left shadow-soft transition ${
                  view.myVote === "lie"
                    ? "border-coral bg-blush/70"
                    : "border-transparent bg-white enabled:hover:border-blush"
                } disabled:cursor-default`}
              >
                <Icon name="mask" className="mx-auto h-8 w-8" />
                <span className="mt-2 block font-display text-xl font-semibold text-ink">
                  Lie
                </span>
                <span className="mt-1 block text-xs font-semibold text-ink-soft">
                  Completely invented
                </span>
              </button>
            </div>
            <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
              {view.submitted}/{view.total} voted
            </p>
          </>
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
          reveal.groupCorrect ? "bg-mint/40" : "bg-blush/50"
        }`}
      >
        <p className="text-4xl">{reveal.groupCorrect ? <Icon name="target" className="mx-auto h-10 w-10" /> : <Icon name="mask" className="mx-auto h-10 w-10" />}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.groupCorrect ? "The group caught it" : "The group got fooled"}
        </p>
        <p className="mt-2 font-display text-2xl font-semibold text-ink">
          {reveal.statement}
        </p>
        <p className="mt-2 text-sm font-bold text-ink-soft">
          It was {reveal.wasLie ? "a lie" : "the truth"}. Storyteller:{" "}
          {reveal.liarName}
        </p>
      </motion.div>

      <div className="party-card grid grid-cols-2 gap-3 p-4">
        <div className="rounded-2xl bg-mint/50 p-3 text-center">
          <p className="font-display text-2xl font-semibold text-[#0F7F6C]">
            {reveal.truthVotes}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#0F7F6C]">
            said truth
          </p>
        </div>
        <div className="rounded-2xl bg-blush/60 p-3 text-center">
          <p className="font-display text-2xl font-semibold text-[#B83232]">
            {reveal.lieVotes}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#B83232]">
            said lie
          </p>
        </div>
      </div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          The two statements
        </p>
        <div className="mt-3 space-y-2 text-sm font-semibold text-ink">
          <p className="rounded-xl bg-mint/25 px-3 py-2">
            <Icon name="check" className="inline h-4 w-4" /> {reveal.truth}
          </p>
          <p className="rounded-xl bg-blush/35 px-3 py-2">
            <Icon name="mask" className="inline h-4 w-4" /> {reveal.lie}
          </p>
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
