"use client";

import { Icon } from "@/components/ui/Icon";

import AnimatedResultBar from "@/components/game/AnimatedResultBar";
import AnswerInput from "@/components/game/AnswerInput";
import AvatarBubble from "@/components/game/AvatarBubble";
import PromptCard from "@/components/game/PromptCard";
import VoteButton from "@/components/game/VoteButton";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type Clue = { id: string; answer: string };

type ImpostorReveal = {
  prompt: { id: string; text: string };
  impostorIds: string[];
  impostorNames: string[];
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
  voteCount: number;
};

export type ImpostorView = {
  phase: "answer" | "discussion" | "vote" | "reveal";
  round: number;
  rounds: number;
  mode: string;
  isImpostor: boolean;
  submitted: number;
  total: number;
  youSubmitted: boolean;
  answerMs: number;
  voteMs: number;
  discussionMs: number;
  prompt: string | null;
  teammates?: string[];
  clues?: Clue[];
  myVote?: string | null;
  votesSubmitted?: number;
  totalVoters?: number;
  promptIsSecret?: boolean;
  reveal?: ImpostorReveal | null;
};

function ClueList({ clues }: { clues: Clue[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {clues.map((clue, index) => (
        <div
          key={clue.id}
          className="rounded-2xl border border-lavender/50 bg-white px-4 py-3 shadow-soft"
        >
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

export default function ImpostorGame({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: ImpostorView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();
  const clues = view.clues || [];

  if (view.phase === "answer") {
    return (
      <div className="space-y-4">
        <PromptCard
          kicker={view.isImpostor ? "You are the impostor" : "The secret prompt"}
          icon={view.isImpostor ? "mask" : "key"}
        >
          {view.prompt || "You do not get the prompt. Read the room and blend in."}
        </PromptCard>

        {view.isImpostor && (
          <div className="rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm font-bold text-[#B83232]">
            {view.teammates && view.teammates.length > 0
              ? `Your co-conspirator: ${view.teammates.join(", ")}. Do not make it obvious.`
              : "Nobody else knows the prompt. Send a clue that could belong to anyone."}
          </div>
        )}

        <div className="party-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Send one short clue — no need to explain it yet
          </p>
          <AnswerInput
            autoFocus
            maxLength={120}
            placeholder="Your clue…"
            submitLabel="Send clue"
            disabled={view.youSubmitted}
            onSubmit={(value) => send("answer", { value })}
          />
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-ink-soft">
            <span>
              {view.submitted}/{view.total} clues in
            </span>
            <span>
              {Math.ceil(view.answerMs / 1000)}s
            </span>
          </div>
        </div>

        {view.youSubmitted && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Clue sent. Waiting for everyone else…
          </p>
        )}
      </div>
    );
  }

  if (view.phase === "discussion") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Discussion" icon="megaphone" compact>
          {view.prompt || "You are still in the dark. Use the clues."}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Who does not belong?</span>
          <span>{Math.ceil(view.discussionMs / 1000)}s to argue</span>
        </div>

        <ClueList clues={clues} />

        <p className="text-center text-xs font-semibold text-ink-soft">
          Clues are anonymous. The vote opens when the timer ends.
        </p>
      </div>
    );
  }

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Vote for the impostor" icon="search" compact>
          {view.prompt || "Trust the clues, not the confidence."}
        </PromptCard>

        <ClueList clues={clues} />

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Who was faking it?</span>
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
  const maxVotes = Math.max(1, ...reveal.tally.map((row) => row.count));

  return (
    <div className="space-y-4">
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`party-card p-6 text-center ${
          reveal.caught ? "bg-mint/50" : "bg-coral/15"
        }`}
      >
        <p className="text-4xl">{reveal.caught ? <Icon name="sparkles" className="mx-auto h-10 w-10" /> : <Icon name="mask" className="mx-auto h-10 w-10" />}</p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.noConsensus
            ? "No consensus"
            : reveal.caught
              ? "Impostor caught"
              : "The impostor got away"}
        </p>
        <p className="mt-1 font-display text-3xl font-semibold text-ink">
          {reveal.impostorNames.join(" & ")}
        </p>
        <p className="mt-1 text-sm font-bold text-ink-soft">
          {reveal.accusedName
            ? `The group accused ${reveal.accusedName}.`
            : "The vote was split."}
        </p>
      </motion.div>

      <PromptCard kicker="The real prompt" icon="key" compact>
        {reveal.prompt.text}
      </PromptCard>

      <div className="party-card space-y-3 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Accusation tally
        </p>
        {reveal.tally.length === 0 ? (
          <p className="text-sm font-semibold text-ink-soft">No votes were cast.</p>
        ) : (
          reveal.tally.map((row, index) => (
            <AnimatedResultBar
              key={row.playerId}
              label={row.name}
              value={row.count}
              max={maxVotes}
              index={index}
              suffix="votes"
              highlight={row.playerId === reveal.accusedId}
            />
          ))
        )}
      </div>

      <div className="party-card p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
          Clues and their authors
        </p>
        <div className="space-y-2">
          {reveal.clues.map((clue) => (
            <div
              key={clue.playerId}
              className="flex items-center gap-2 rounded-xl bg-lavender/20 px-3 py-2"
            >
              <AvatarBubble name={clue.name} size="sm" />
              <p className="text-sm font-semibold text-ink">
                <span className="font-bold">{clue.name}:</span> {clue.answer}
              </p>
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
    </div>
  );
}
