"use client";

import AvatarBubble from "@/components/game/AvatarBubble";
import FloatingBlobs from "@/components/FloatingBlobs";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/components/AuthProvider";
import { useRoom } from "@/hooks/useRoom";
import { copyInviteLink } from "@/lib/play";
import type { CatalogGame, RoomView } from "@/stores/roomStore";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Player = RoomView["players"][number];

function LobbyFrame({
  children,
  onBack,
  backLabel,
}: {
  children: ReactNode;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <main className="relative min-h-screen px-4 py-8">
      <FloatingBlobs />
      <div className="relative z-10 mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted transition hover:text-white"
          >
            ← {backLabel}
          </button>
          <UserMenu />
        </div>
        {children}
      </div>
    </main>
  );
}

function PlayerTile({
  player,
  kickLabel,
  onKick,
}: {
  player: Player;
  kickLabel?: string;
  onKick?: () => void;
}) {
  return (
    <div className="flex w-[76px] flex-col items-center gap-1.5 text-center">
      <div className="relative">
        <AvatarBubble
          name={player.name}
          src={player.avatarUrl}
          size="md"
          isHost={player.isHost}
          connected={player.connected}
        />
      </div>
      <p className="w-full truncate text-xs font-bold text-white">{player.name}</p>
      <p className="text-[10px] font-semibold text-text-muted">
        {player.connected ? "Ready" : "Reconnecting"}
      </p>
      {onKick && (
        <button
          type="button"
          onClick={onKick}
          className="rounded-md bg-danger/10 px-1.5 py-0.5 text-[9px] font-bold text-red-300 transition hover:bg-danger/20"
        >
          {kickLabel}
        </button>
      )}
    </div>
  );
}

function GameOption({
  game,
  selected,
  playersNeeded,
  onClick,
}: {
  game: CatalogGame;
  selected: boolean;
  playersNeeded: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-bg-card hover:border-border-hover"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{game.name}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{game.description}</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
            {game.minPlayers}–{game.maxPlayers} players
            {playersNeeded > 0 ? ` · Need ${playersNeeded} more` : " · Ready"}
          </p>
        </div>
        <span className={`text-sm font-black ${selected ? "text-accent" : "text-text-muted"}`}>
          {selected ? "●" : "○"}
        </span>
      </div>
    </button>
  );
}

export default function LobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { isSignedIn } = useAuth();

  const [inviteCopied, setInviteCopied] = useState(false);

  const { room, status, error, kicked, act, leave, clearError } = useRoom(
    sessionId as string
  );

  const groupId = room?.groupId || searchParams.get("groupId") || "";
  const exitPath = isSignedIn
    ? groupId
      ? `/group/${groupId}`
      : "/dashboard"
    : "/";
  const exitLabel = isSignedIn && groupId ? "Group" : "Home";

  const players = room?.players ?? [];
  const isHost = !!room?.you?.isHost;
  const selectedGame =
    room?.catalog.find((game) => game.id === room.gameId) ?? null;
  const selectedMode =
    selectedGame?.modes.find((mode) => mode.id === room?.mode) ?? null;
  const joinCode = room?.joinCode || "";
  const groupName = room?.groupName || "Game room";

  useEffect(() => {
    if (room && room.phase !== "lobby") {
      router.replace(`/game/${sessionId}`);
    }
  }, [room, room?.phase, router, sessionId]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(clearError, 4000);
    return () => window.clearTimeout(timer);
  }, [error, clearError]);

  async function handleCopyInvite() {
    if (!joinCode) return;
    try {
      await copyInviteLink(joinCode);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      alert("Could not copy the invite link");
    }
  }

  if (kicked) {
    return (
      <LobbyFrame onBack={() => router.push(exitPath)} backLabel={exitLabel}>
        <div className="glass-card mx-auto max-w-md p-8 text-center">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Removed from the room
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {error?.message || "The host removed you from this room."}
          </p>
          <button
            type="button"
            onClick={() => router.push(exitPath)}
            className="neon-btn neon-btn-purple mt-6 w-full"
          >
            Back to {exitLabel.toLowerCase()}
          </button>
        </div>
      </LobbyFrame>
    );
  }

  if (!room) {
    return (
      <LobbyFrame onBack={() => router.push(exitPath)} backLabel={exitLabel}>
        <div className="glass-card mx-auto max-w-md p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <h1 className="mt-4 text-lg font-bold text-white">
            {status === "error" ? "Room unavailable" : "Finding your seat"}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {error?.message || "Connecting to the lobby…"}
          </p>
          {status === "error" && (
            <button
              type="button"
              onClick={() => router.push(exitPath)}
              className="neon-btn neon-btn-purple mt-6 w-full"
            >
              Back to {exitLabel.toLowerCase()}
            </button>
          )}
        </div>
      </LobbyFrame>
    );
  }

  const offline = players.filter((player) => !player.connected);
  let disabledReason = "";
  if (!selectedGame) disabledReason = "Pick a game first";
  else if (players.length < selectedGame.minPlayers)
    disabledReason = `Need ${selectedGame.minPlayers} players — ${players.length} in the room`;
  else if (players.length > selectedGame.maxPlayers)
    disabledReason = `This game allows ${selectedGame.maxPlayers} players`;
  else if (offline.length > 0)
    disabledReason = `Waiting for ${offline.map((player) => player.name).join(", ")}`;
  else if (status !== "ready") disabledReason = "Reconnecting…";

  return (
    <LobbyFrame onBack={() => router.push(exitPath)} backLabel={exitLabel}>
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Game room
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
          {groupName}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
            Room code
            <span className="font-mono text-sm tracking-[0.25em] text-accent">
              {joinCode || "—"}
            </span>
          </span>
          {joinCode && (
            <button
              type="button"
              onClick={handleCopyInvite}
              className="rounded-lg border border-border bg-bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary transition hover:border-border-hover hover:text-white"
            >
              {inviteCopied ? "Invite copied" : "Copy invite"}
            </button>
          )}
          {isSignedIn && groupId && (
            <button
              type="button"
              onClick={() => router.push(`/group/${groupId}`)}
              className="rounded-lg border border-border bg-bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary transition hover:border-border-hover hover:text-white"
            >
              Group page
            </button>
          )}
        </div>
      </header>

      {status !== "ready" && (
        <p className="mb-4 rounded-xl border border-accent/20 bg-accent/10 px-4 py-2 text-center text-xs font-semibold text-text-secondary">
          {status === "reconnecting"
            ? "Connection lost — reconnecting. Your seat is held for 30s."
            : "Connecting to the room…"}
        </p>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            <span>{error.message}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-[10px] font-bold uppercase tracking-wider text-red-200/70 hover:text-white"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="glass-card mb-5 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-white">
            Players <span className="text-text-muted">{players.length}</span>
          </h2>
          <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
            In room
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          <AnimatePresence>
            {players.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <PlayerTile
                  player={player}
                  kickLabel={isHost && player.id !== room.you?.id ? "Kick" : undefined}
                  onKick={
                    isHost && player.id !== room.you?.id
                      ? () => act("kick", { playerId: player.id })
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {selectedGame && players.length < selectedGame.minPlayers && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <p className="text-xs font-semibold text-amber-200">
              Need {selectedGame.minPlayers - players.length} more player
              {selectedGame.minPlayers - players.length === 1 ? "" : "s"} for{" "}
              {selectedGame.name}.
            </p>
            {joinCode && (
              <button
                type="button"
                onClick={handleCopyInvite}
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200 underline decoration-amber-200/40 underline-offset-4 hover:text-white"
              >
                {inviteCopied ? "Invite copied" : "Copy invite"}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
            Pick a game
          </h2>
          {selectedMode && (
            <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[10px] font-bold text-text-secondary">
              {selectedMode.label}
            </span>
          )}
        </div>

        <div className="grid gap-2">
          {room.catalog.map((game) => (
            <GameOption
              key={game.id}
              game={game}
              selected={room.gameId === game.id}
              playersNeeded={Math.max(0, game.minPlayers - players.length)}
              onClick={() =>
                act("selectGame", {
                  gameId: game.id,
                  mode: game.modes[0]?.id || "classic",
                })
              }
            />
          ))}
          {room.catalog.length === 0 && (
            <p className="glass-card p-5 text-sm text-text-secondary">
              No games are available yet.
            </p>
          )}
        </div>

        <AnimatePresence initial={false}>
          {selectedGame && (
            <motion.div
              key={`modes-${selectedGame.id}`}
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                Mode
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedGame.modes.map((mode) => {
                  const active = room.mode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        act("selectGame", {
                          gameId: selectedGame.id,
                          mode: mode.id,
                        })
                      }
                      className={`rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-accent bg-accent/10"
                          : "border-border bg-bg-card hover:border-border-hover"
                      }`}
                    >
                      <p className={`text-xs font-bold ${active ? "text-white" : "text-text-secondary"}`}>
                        {mode.label}
                      </p>
                      <p className={`mt-0.5 text-[11px] ${active ? "text-white/70" : "text-text-muted"}`}>
                        {mode.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="sticky bottom-4">
        <button
          type="button"
          onClick={() => act("start")}
          disabled={Boolean(disabledReason)}
          className="neon-btn neon-btn-purple min-h-14 w-full py-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {disabledReason || "Start game →"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          leave();
          router.push(exitPath);
        }}
        className="mx-auto mt-4 block py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted transition hover:text-white"
      >
        Leave room
      </button>
    </LobbyFrame>
  );
}
