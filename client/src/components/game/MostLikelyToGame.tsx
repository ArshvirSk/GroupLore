"use client";

import AnimatedResultBar from "@/components/game/AnimatedResultBar";
import AvatarBubble from "@/components/game/AvatarBubble";
import PromptCard from "@/components/game/PromptCard";
import VoteButton from "@/components/game/VoteButton";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type MltTally = {
  playerId: string;
  name: string;
  count: number;
};

type MltReveal = {
  prompt: string;
  tally: MltTally[];
  topPlayerIds: string[];
  topPlayerNames: string[];
  roundWinners: string[];
  voters:
    | {
        voterId: string;
        voterName: string;
        targetId: string;
        targetName: string;
      }[]
    | null;
  voteCount: number;
};

export type MltView = {
  phase: "vote" | "reveal";
  round: number;
  rounds: number;
  prompt: string;
  submitted: number;
  total: number;
  myVote: string | null;
  reveal?: MltReveal | null;
  showVoters?: boolean;
};

export default function MostLikelyToGame({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: MltView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();
  const me = room.you;
  const voting = view.phase === "vote";
  const maxVotes = Math.max(1, ...(view.reveal?.tally.map((row) => row.count) || [1]));

  if (voting) {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Most likely to…" icon="crown">
          {view.prompt}
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Vote for one friend</span>
          <span>
            {view.submitted}/{view.total} voted
          </span>
        </div>

        <div className="grid gap-2">
          {room.players
            .filter((player) => player.id !== me?.id)
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
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-sm font-bold text-ink-soft"
          >
            Locked in. Waiting for everyone else…
          </motion.p>
        )}

        <p className="text-center text-xs font-semibold text-ink-soft">
          Votes stay hidden until the reveal.
        </p>
      </div>
    );
  }

  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <div className="space-y-4">
      <PromptCard kicker="The group has spoken" icon="megaphone" compact>
        {view.prompt}
      </PromptCard>

      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card bg-honey/40 p-5 text-center"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.topPlayerNames.length > 1 ? "Top answers" : "Most likely"}
        </p>
        <p className="mt-1 font-display text-3xl font-semibold text-ink">
          {reveal.topPlayerNames.join(" & ") || "Nobody"}
        </p>
        <p className="mt-1 text-sm font-bold text-ink-soft">
          {reveal.roundWinners.length} player
          {reveal.roundWinners.length === 1 ? "" : "s"} scored +1
        </p>
      </motion.div>

      <div className="party-card space-y-3 p-5">
        {reveal.tally.length === 0 ? (
          <p className="text-center text-sm font-semibold text-ink-soft">
            No votes this round.
          </p>
        ) : (
          reveal.tally.map((row, index) => (
            <AnimatedResultBar
              key={row.playerId}
              label={row.name}
              value={row.count}
              max={maxVotes}
              index={index}
              suffix="votes"
              highlight={reveal.topPlayerIds.includes(row.playerId)}
            />
          ))
        )}
      </div>

      {reveal.voters && reveal.voters.length > 0 && (
        <div className="party-card p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Who voted for whom
          </p>
          <div className="flex flex-wrap gap-2">
            {reveal.voters.map((vote) => (
              <span
                key={vote.voterId}
                className="inline-flex items-center gap-1.5 rounded-full bg-lavender/30 px-2.5 py-1 text-xs font-bold text-ink"
              >
                <AvatarBubble name={vote.voterName} size="sm" />
                {vote.voterName} → {vote.targetName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
