"use client";

import AnimatedResultBar from "@/components/game/AnimatedResultBar";
import AvatarBubble from "@/components/game/AvatarBubble";
import GameShell from "@/components/game/GameShell";
import Leaderboard from "@/components/game/Leaderboard";
import PromptCard from "@/components/game/PromptCard";
import VoteButton from "@/components/game/VoteButton";
import { useRoom } from "@/hooks/useRoom";
import type { RoomView } from "@/stores/roomStore";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

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

type MltView = {
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

function MostLikelyTo({
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
        <PromptCard kicker="Most likely to…" emoji="👑">
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
      <PromptCard kicker="The group has spoken" emoji="🥁" compact>
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

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { room, status, error, kicked, act, send, leave, clearError } =
    useRoom(sessionId);

  const groupId = room?.groupId || "";
  const gameMeta = room?.catalog.find((game) => game.id === room.gameId);
  const gameView = (room?.game || null) as MltView | null;

  useEffect(() => {
    if (room?.phase === "lobby") {
      router.replace(`/lobby/${sessionId}${groupId ? `?groupId=${groupId}` : ""}`);
    }
  }, [room?.phase, router, sessionId, groupId]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  const exit = () => {
    if (
      room?.phase === "playing" &&
      !window.confirm("Leave the game? Your seat will be given up.")
    ) {
      return;
    }
    leave();
    router.push(groupId ? `/group/${groupId}` : "/dashboard");
  };

  if (kicked) {
    return (
      <GameShell title="Removed from game" accent="grape">
        <div className="party-card p-6 text-center">
          <p className="text-4xl">👋</p>
          <p className="mt-3 font-display text-xl font-semibold text-ink">
            {error?.message || "You were removed from this room."}
          </p>
          <button
            onClick={() => router.push(groupId ? `/group/${groupId}` : "/dashboard")}
            className="mt-5 min-h-11 rounded-full bg-grape px-6 font-display text-sm font-semibold text-white"
          >
            Back to group
          </button>
        </div>
      </GameShell>
    );
  }

  if (!room) {
    return (
      <GameShell title="Game" accent="grape" status={status}>
        <div className="party-card p-8 text-center">
          {status === "error" ? (
            <>
              <p className="text-3xl">📡</p>
              <p className="mt-3 font-display text-lg font-semibold text-ink">
                {error?.message || "Could not join the game"}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 min-h-11 rounded-full bg-grape px-6 font-display text-sm font-semibold text-white"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-lavender border-t-grape" />
              <p className="mt-4 font-display text-lg font-semibold text-ink">
                Joining the game…
              </p>
            </>
          )}
        </div>
      </GameShell>
    );
  }

  const activeView = room.phase === "playing" ? gameView : null;
  const results = room.phase === "results";

  return (
    <GameShell
      title={gameMeta?.name || "Game"}
      emoji={gameMeta?.emoji}
      accent={gameMeta?.accent || "grape"}
      round={gameView?.round}
      totalRounds={gameView?.rounds}
      endsAt={room.endsAt}
      serverNow={room.serverNow}
      status={status}
      onExit={exit}
      exitLabel="Quit"
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-2 text-center text-sm font-bold text-[#B83232]"
          >
            {error.message}
          </motion.div>
        )}
      </AnimatePresence>

      {activeView && room.gameId === "most-likely-to" && (
        <MostLikelyTo room={room} view={activeView} send={send} />
      )}

      {activeView && room.gameId !== "most-likely-to" && (
        <div className="party-card p-8 text-center">
          <p className="text-3xl">🚧</p>
          <p className="mt-3 font-display text-lg font-semibold text-ink">
            This game is not available yet.
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            Ask the host to end the game and pick another one.
          </p>
          {room.you?.isHost && (
            <button
              onClick={() => act("end")}
              className="mt-4 min-h-11 rounded-full bg-grape px-6 font-display text-sm font-semibold text-white"
            >
              End game
            </button>
          )}
        </div>
      )}

      {results && room.result && (
        <div className="space-y-4">
          <div className="party-card bg-honey/30 p-6 text-center">
            <p className="text-4xl">🏆</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
              Final scores
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">
              {room.result.ranking
                .filter((entry) => entry.isWinner)
                .map((entry) => entry.name)
                .join(" & ") || "Nobody scored"}
            </p>
          </div>

          <Leaderboard entries={room.result.ranking} youId={room.you?.id} />

          {room.you?.isHost ? (
            <button
              onClick={() => act("restart")}
              className="min-h-14 w-full rounded-2xl bg-grape px-6 font-display text-base font-semibold text-white shadow-pop transition hover:bg-[#7C4DEB]"
            >
              Back to lobby →
            </button>
          ) : (
            <p className="text-center text-sm font-semibold text-ink-soft">
              Waiting for the host to start another game…
            </p>
          )}

          <button
            onClick={() => {
              leave();
              router.push(groupId ? `/group/${groupId}` : "/dashboard");
            }}
            className="mx-auto block min-h-11 rounded-full px-4 text-xs font-bold uppercase tracking-wide text-ink-soft underline-offset-4 hover:underline"
          >
            Back to group
          </button>
        </div>
      )}
    </GameShell>
  );
}
