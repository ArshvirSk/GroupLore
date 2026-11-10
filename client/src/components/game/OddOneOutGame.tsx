"use client";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import VoteButton from "@/components/game/VoteButton";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type Clue = { id: string; answer: string };

type OddReveal = {
  prompt: string;
  oddPrompt: string;
  oddPlayerId: string;
  oddName: string;
  accusedId: string | null;
  accusedName: string | null;
  caught: boolean;
  noConsensus: boolean;
  tally: { playerId: string; name: string; count: number }[];
  voters: {
    voterId: string;
    voterName: string;
    targetId: string;
    targetName: string;
  }[];
  clues: { playerId: string; name: string; answer: string }[];
  roundPoints: { playerId: string; name: string; points: number }[];
};

export type OddOneOutView = {
  phase: "answer" | "discussion" | "vote" | "reveal";
  round: number;
  rounds: number;
  mode: string;
  isOdd: boolean;
  answerMs: number;
  submitted: number;
  total: number;
  youSubmitted: boolean;
  prompt: string;
  discussionMs?: number;
  clues?: Clue[];
  myVote?: string | null;
  votesSubmitted?: number;
  totalVoters?: number;
  reveal?: OddReveal | null;
};

function Clues({ clues }: { clues: Clue[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {clues.map((clue, index) => (
        <div key={clue.id} className="rounded-2xl bg-white px-4 py-3 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
            Clue {index + 1}
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">
            {clue.answer}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function OddOneOutGame({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: OddOneOutView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();
  const clues = view.clues || [];

  if (view.phase === "answer") {
    return (
      <div className="space-y-4">
        <PromptCard
          kicker={view.isOdd ? "You are the odd one out" : "Your prompt"}
          emoji={view.isOdd ? "🎭" : "🗝️"}
        >
          {view.prompt}
        </PromptCard>

        {view.isOdd && (
          <div className="rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm font-bold text-[#B83232]">
            Your prompt is slightly different from everyone else&apos;s. Give an
            answer that could belong to both — and don&apos;t get caught.
          </div>
        )}

        <div className="party-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Send one short answer
          </p>
          <AnswerInput
            autoFocus
            maxLength={100}
            placeholder="Your answer…"
            submitLabel="Send it"
            disabled={view.youSubmitted}
            onSubmit={(value) => send("answer", { value })}
          />
          <div className="mt-3 flex justify-between text-xs font-bold text-ink-soft">
            <span>
              {view.submitted}/{view.total} answers in
            </span>
            <span>{Math.ceil(view.answerMs / 1000)}s</span>
          </div>
        </div>

        {view.youSubmitted && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Sent. Waiting for the room…
          </p>
        )}
      </div>
    );
  }

  if (view.phase === "discussion") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Your prompt" emoji="🗣️" compact>
          {view.prompt}
        </PromptCard>
        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Two prompts are in play</span>
          <span>{Math.ceil((view.discussionMs || 0) / 1000)}s to argue</span>
        </div>
        <Clues clues={clues} />
        <p className="text-center text-xs font-semibold text-ink-soft">
          Answers are anonymous. Vote when the timer ends.
        </p>
      </div>
    );
  }

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Find the odd one" emoji="🎭" compact>
          {view.prompt}
        </PromptCard>
        <Clues clues={clues} />
        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Who had the different prompt?</span>
          <span>
            {view.votesSubmitted}/{view.totalVoters} voted
          </span>
        </div>
        <div className="grid gap-2">
          {room.players
            .filter((player) => player.id !== room.you?.id)
            .map((player) => (
              <VoteButton
                key={player.id}
                name={player.name}
                avatarUrl={player.avatarUrl}
                subtitle={!player.connected ? "away" : undefined}
                selected={view.myVote === player.id}
                disabled={Boolean(view.myVote) || !player.connected}
                onClick={() => send("vote", { targetPlayerId: player.id })}
              />
            ))}
        </div>
        {view.myVote && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Vote locked. Waiting for the reveal…
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
        initial={reduced ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`party-card p-6 text-center ${
          reveal.caught ? "bg-mint/50" : "bg-coral/15"
        }`}
      >
        <p className="text-4xl">{reveal.caught ? "🎉" : "🎭"}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.noConsensus
            ? "No consensus"
            : reveal.caught
              ? "Odd one caught"
              : "The odd one escaped"}
        </p>
        <p className="mt-1 font-display text-2xl font-semibold text-ink">
          {reveal.oddName}
        </p>
        <p className="mt-1 text-sm font-bold text-ink-soft">
          {reveal.accusedName
            ? `The group accused ${reveal.accusedName}.`
            : "The vote was split."}
        </p>
      </motion.div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
            Everyone else got
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">
            {reveal.prompt}
          </p>
        </div>
        <div className="rounded-2xl bg-blush/40 p-4 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
            The odd one got
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">
            {reveal.oddPrompt}
          </p>
        </div>
      </div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Answers and authors
        </p>
        <div className="mt-2 space-y-2">
          {reveal.clues.map((clue) => (
            <div
              key={`${clue.playerId}-${clue.answer}`}
              className="rounded-xl bg-lavender/20 px-3 py-2 text-sm font-semibold text-ink"
            >
              <span className="font-bold">{clue.name}:</span> {clue.answer}
            </div>
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
                className="rounded-full bg-mint/60 px-3 py-1 text-sm font-bold text-[#0F7F6C]"
              >
                {entry.name} +{entry.points}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Vote tally
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.tally.map((row) => (
            <span
              key={row.playerId}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                row.playerId === reveal.oddPlayerId
                  ? "bg-coral/20 text-[#B83232]"
                  : "bg-ink/5 text-ink-soft"
              }`}
            >
              {row.name}: {row.count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
