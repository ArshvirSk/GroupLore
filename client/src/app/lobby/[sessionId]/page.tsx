"use client";

import AvatarBubble from "@/components/game/AvatarBubble";
import GameShell from "@/components/game/GameShell";
import { useRoom } from "@/hooks/useRoom";
import type { CatalogGame } from "@/stores/roomStore";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

function PlayerTile({
  name,
  avatarUrl,
  isHost,
  ready,
  connected,
  canKick,
  onKick,
}: {
  name: string;
  avatarUrl?: string | null;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  canKick: boolean;
  onKick: () => void;
}) {
  return (
    <div className="relative flex w-20 flex-col items-center gap-2 text-center">
      <AvatarBubble
        name={name}
        src={avatarUrl}
        size="lg"
        isHost={isHost}
        ready={ready}
        connected={connected}
      />
      <p className="w-full truncate text-xs font-bold text-ink">{name}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">
        {!connected ? "away" : isHost ? "host" : ready ? "ready" : "waiting"}
      </p>
      {canKick && (
        <button
          onClick={onKick}
          aria-label={`Remove ${name}`}
          className="absolute -right-1 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-coral text-xs font-bold text-white shadow"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function GameOption({
  game,
  selected,
  onSelect,
}: {
  game: CatalogGame;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-2xl border-2 bg-white p-4 text-left shadow-soft transition ${
        selected
          ? "border-grape shadow-pop"
          : "border-transparent hover:border-lavender"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{game.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-ink">
            {game.name}
          </p>
          <p className="text-xs font-semibold text-ink-soft">{game.description}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            {game.minPlayers}–{game.maxPlayers} players
          </p>
        </div>
        {selected && <span className="text-grape">●</span>}
      </div>
    </button>
  );
}

export default function LobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const reduced = useReducedMotion();

  const { room, status, error, kicked, act, leave, clearError } =
    useRoom(sessionId);

  const groupId = room?.groupId || searchParams.get("groupId") || "";
  const players = room?.players || [];
  const me = room?.players.find((player) => player.id === room.you?.id);
  const isHost = Boolean(room?.you?.isHost);
  const selectedGame =
    room?.catalog.find((game) => game.id === room.gameId) || null;
  const selectedMode = selectedGame?.modes.find(
    (mode) => mode.id === room?.mode,
  );

  useEffect(() => {
    if (room && room.phase !== "lobby") {
      router.replace(`/game/${sessionId}`);
    }
  }, [room, room?.phase, router, sessionId]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  if (kicked) {
    return (
      <GameShell title="Removed from room" accent="grape">
        <div className="party-card p-6 text-center">
          <p className="text-4xl">👋</p>
          <p className="mt-3 font-display text-xl font-semibold text-ink">
            {error?.message || "The host removed you from this room."}
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
      <GameShell title="Joining lobby" accent="grape" status={status}>
        <div className="party-card p-8 text-center">
          {status === "error" ? (
            <>
              <p className="text-3xl">📡</p>
              <p className="mt-3 font-display text-lg font-semibold text-ink">
                {error?.message || "Could not join the room"}
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
                Finding your seat…
              </p>
            </>
          )}
        </div>
      </GameShell>
    );
  }

  const notReady = players.filter(
    (player) => player.id !== room.hostId && !player.ready,
  );
  const offline = players.filter((player) => !player.connected);

  let disabledReason = "";
  if (!selectedGame) disabledReason = "Pick a game first";
  else if (players.length < selectedGame.minPlayers)
    disabledReason = `Need ${selectedGame.minPlayers} players — ${players.length} in the room`;
  else if (players.length > selectedGame.maxPlayers)
    disabledReason = `This game allows ${selectedGame.maxPlayers} players`;
  else if (offline.length > 0)
    disabledReason = `Waiting for ${offline.map((player) => player.name).join(", ")}`;
  else if (notReady.length > 0)
    disabledReason = `Waiting for ${notReady.map((player) => player.name).join(", ")} to ready up`;
  else if (status !== "ready") disabledReason = "Reconnecting…";

  return (
    <GameShell
      title="Game lobby"
      emoji="🎉"
      accent="grape"
      status={status}
      onExit={() => router.push(groupId ? `/group/${groupId}` : "/dashboard")}
      exitLabel="Group"
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

      <section className="party-card mb-5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">
            Players{" "}
            <span className="text-sm font-semibold text-ink-soft">
              {players.length}
            </span>
          </h2>
          <span className="rounded-full bg-mint px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">
            {players.filter((player) => player.ready || player.isHost).length}/
            {players.length} set
          </span>
        </div>

        <div className="flex flex-wrap gap-4">
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={reduced ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 320, damping: 22 }}
            >
              <PlayerTile
                name={player.name}
                avatarUrl={player.avatarUrl}
                isHost={player.isHost}
                ready={player.ready}
                connected={player.connected}
                canKick={isHost && player.id !== room.you?.id}
                onKick={() => act("kick", { playerId: player.id })}
              />
            </motion.div>
          ))}
        </div>

        {!isHost && (
          <button
            onClick={() => act("ready", { ready: !me?.ready })}
            className={`mt-5 min-h-12 w-full rounded-2xl font-display text-sm font-semibold transition ${
              me?.ready
                ? "border-2 border-lime bg-mint text-ink"
                : "bg-grape text-white shadow-soft hover:bg-[#7C4DEB]"
            }`}
          >
            {me?.ready ? "✓ You're ready" : "Ready up"}
          </button>
        )}
      </section>

      <section className="mb-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">
            {isHost ? "Pick a game" : "Host's pick"}
          </h2>
          {selectedMode && selectedMode.id !== "classic" && (
            <span className="rounded-full bg-lavender/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">
              {selectedMode.label}
            </span>
          )}
        </div>

        {isHost ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {room.catalog.map((game) => (
              <div key={game.id}>
                <GameOption
                  game={game}
                  selected={game.id === room.gameId}
                  onSelect={() =>
                    act("selectGame", {
                      gameId: game.id,
                      mode: game.modes[0]?.id || "classic",
                    })
                  }
                />
                <AnimatePresence>
                  {game.id === room.gameId && game.modes.length > 1 && (
                    <motion.div
                      initial={reduced ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-wrap gap-2 overflow-hidden pt-2"
                    >
                      {game.modes.map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() =>
                            act("selectGame", {
                              gameId: game.id,
                              mode: mode.id,
                            })
                          }
                          title={mode.description}
                          className={`min-h-9 rounded-full px-3 text-[11px] font-bold transition ${
                            room.mode === mode.id
                              ? "bg-grape text-white"
                              : "bg-white text-ink-soft shadow-soft hover:text-ink"
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        ) : selectedGame ? (
          <div className="party-card flex items-center gap-3 p-4">
            <span className="text-2xl">{selectedGame.emoji}</span>
            <div>
              <p className="font-display font-semibold text-ink">
                {selectedGame.name}
              </p>
              <p className="text-xs font-semibold text-ink-soft">
                {selectedMode?.label || "Classic"}
              </p>
            </div>
          </div>
        ) : (
          <div className="party-card p-5 text-center text-sm font-semibold text-ink-soft">
            The host is choosing a game…
          </div>
        )}

        {room.catalog.length === 0 && (
          <p className="mt-3 text-center text-sm font-semibold text-ink-soft">
            No games are available right now.
          </p>
        )}
      </section>

      {isHost ? (
        <div className="sticky bottom-4">
          <button
            onClick={() => act("start")}
            disabled={Boolean(disabledReason)}
            className="min-h-14 w-full rounded-2xl bg-grape px-6 font-display text-base font-semibold text-white shadow-pop transition enabled:hover:bg-[#7C4DEB] disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink-soft disabled:shadow-none"
          >
            {disabledReason || "Start game →"}
          </button>
        </div>
      ) : (
        <p className="pb-4 text-center text-sm font-semibold text-ink-soft">
          {disabledReason || "Waiting for the host to start"}
        </p>
      )}

      <button
        onClick={() => {
          leave();
          router.push(groupId ? `/group/${groupId}` : "/dashboard");
        }}
        className="mx-auto mt-4 block min-h-11 rounded-full px-4 text-xs font-bold uppercase tracking-wide text-ink-soft underline-offset-4 hover:underline"
      >
        Leave room
      </button>
    </GameShell>
  );
}
