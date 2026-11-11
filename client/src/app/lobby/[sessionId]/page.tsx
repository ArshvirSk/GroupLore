"use client";

import AvatarBubble from "@/components/game/AvatarBubble";
import FloatingBlobs from "@/components/FloatingBlobs";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/components/AuthProvider";
import { api, type Lobby, type LobbyPlayer } from "@/lib/api";
import { copyInviteLink } from "@/lib/play";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type CatalogMode = { id: string; label: string; description: string };
type CatalogGame = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tag?: string;
  minPlayers: number;
  maxPlayers: number;
  modes: CatalogMode[];
};

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
  isHost,
  canKick,
  onKick,
}: {
  player: LobbyPlayer;
  isHost: boolean;
  canKick: boolean;
  onKick: () => void;
}) {
  return (
    <div className="flex w-[82px] flex-col items-center gap-1.5 text-center">
      <AvatarBubble
        name={player.display_name}
        size="md"
        isHost={isHost}
        connected={player.connected}
      />
      <p className="w-full truncate text-xs font-bold text-white">
        {player.display_name}
      </p>
      <p className="text-[10px] font-semibold text-text-muted">
        {player.is_guest ? "Guest" : player.connected ? "Ready" : "Offline"}
      </p>
      {canKick && (
        <button
          type="button"
          onClick={onKick}
          className="rounded-md bg-danger/10 px-1.5 py-0.5 text-[9px] font-bold text-red-300 transition hover:bg-danger/20"
        >
          Kick
        </button>
      )}
    </div>
  );
}

export default function LobbyPage() {
  const { sessionId: codeParam } = useParams<{ sessionId: string }>();
  const code = String(codeParam || "").toUpperCase();
  const router = useRouter();
  const { user, isGuest, isLoaded } = useAuth();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [catalog, setCatalog] = useState<CatalogGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [selectedModeId, setSelectedModeId] = useState("classic");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = (await api.getLobby(code)) as Lobby;
      setLobby(next);
      setError("");
      if (next.status === "in_game" && next.active_session_id) {
        router.replace(`/game/${next.active_session_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the lobby");
    } finally {
      setLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    if (!isLoaded || !code) return;
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(`/lobby/${code}`)}`);
      return;
    }
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [isLoaded, user, code, load, router]);

  useEffect(() => {
    api.getCatalog().then(setCatalog).catch(() => {});
  }, []);

  const selectedGame = useMemo(
    () => catalog.find((game) => game.id === selectedGameId) || null,
    [catalog, selectedGameId],
  );

  useEffect(() => {
    if (!selectedGame && catalog.length > 0) {
      setSelectedGameId(catalog[0].id);
      setSelectedModeId(catalog[0].modes[0]?.id || "classic");
    }
  }, [catalog, selectedGame]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const players = lobby?.lobby_players || [];
  const isHost = Boolean(lobby && user && lobby.host_id === user.id);
  const groupId = lobby?.group_id || "";
  const groupName = lobby?.groups?.name || "Quick play";
  const exitPath = groupId ? `/group/${groupId}` : "/dashboard";

  const handleCopy = async () => {
    if (!lobby) return;
    try {
      await copyInviteLink(lobby.code);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setError("Could not copy the invite link");
    }
  };

  const handleStart = async () => {
    if (!lobby || !selectedGame || starting) return;
    setStarting(true);
    setError("");
    try {
      const result = (await api.startLobby(lobby.id, {
        gameId: selectedGame.id,
        mode: selectedModeId,
      })) as { sessionId: string };
      router.push(`/game/${result.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the game");
    } finally {
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    if (!lobby || leaving) return;
    setLeaving(true);
    try {
      await api.leaveLobby(lobby.id);
      router.push(exitPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave the lobby");
      setLeaving(false);
    }
  };

  const handleKick = async (userId: string) => {
    if (!lobby) return;
    try {
      await api.kickLobbyPlayer(lobby.id, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not kick that player");
    }
  };

  if (loading && !lobby) {
    return (
      <LobbyFrame onBack={() => router.push("/dashboard")} backLabel="Home">
        <div className="glass-card mx-auto max-w-md p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <h1 className="mt-4 text-lg font-bold text-white">Finding your room</h1>
          <p className="mt-2 text-sm text-text-secondary">Checking the code…</p>
        </div>
      </LobbyFrame>
    );
  }

  if (!lobby) {
    return (
      <LobbyFrame onBack={() => router.push("/dashboard")} backLabel="Home">
        <div className="glass-card mx-auto max-w-md p-8 text-center">
          <p className="text-4xl">🙈</p>
          <h1 className="mt-3 text-2xl font-black text-white">Room unavailable</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {error || "That room code is not open."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="neon-btn neon-btn-purple mt-6 w-full"
          >
            Back to dashboard
          </button>
        </div>
      </LobbyFrame>
    );
  }

  const connected = players.filter((player) => player.connected).length;
  let disabledReason = "";
  if (!selectedGame) disabledReason = "Pick a game first";
  else if (connected < selectedGame.minPlayers)
    disabledReason = `Need ${selectedGame.minPlayers} players — ${connected} in the room`;
  else if (connected > selectedGame.maxPlayers)
    disabledReason = `This game allows ${selectedGame.maxPlayers} players`;
  else if (starting) disabledReason = "Starting…";

  return (
    <LobbyFrame onBack={() => router.push(exitPath)} backLabel={groupId ? "Group" : "Home"}>
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          {groupId ? "Group lobby" : "Quick play lobby"}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
          {groupName}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
            Room code
            <span className="font-mono text-sm tracking-[0.25em] text-accent">
              {lobby.code}
            </span>
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-border bg-bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary transition hover:border-border-hover hover:text-white"
          >
            {inviteCopied ? "Invite copied" : "Copy invite"}
          </button>
          {groupId && (
            <button
              type="button"
              onClick={() => router.push(`/group/${groupId}`)}
              className="rounded-lg border border-border bg-bg-card px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-secondary transition hover:border-border-hover hover:text-white"
            >
              Group page
            </button>
          )}
          {isHost && <span className="text-[10px] font-bold uppercase tracking-wider text-accent">★ Host</span>}
        </div>
      </header>

      {isGuest && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-xs text-violet-200">
          <span>You&apos;re playing as a guest. Your lobby seat works, but groups and history need an account.</span>
          <button
            type="button"
            onClick={() => router.push(`/upgrade?next=${encodeURIComponent(`/lobby/${lobby.code}`)}`)}
            className="font-bold underline underline-offset-4"
          >
            Save your progress
          </button>
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="glass-card mb-5 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-white">
            Players <span className="text-text-muted">{players.length}</span>
          </h2>
          <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
            {connected} connected
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          {players.map((player) => (
            <PlayerTile
              key={player.user_id}
              player={player}
              isHost={player.user_id === lobby.host_id}
              canKick={isHost && player.user_id !== user?.id}
              onKick={() => void handleKick(player.user_id)}
            />
          ))}
        </div>
      </section>

      <section className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
            Pick a game
          </h2>
          {selectedModeId && (
            <span className="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[10px] font-bold text-text-secondary">
              {selectedGame?.modes.find((mode) => mode.id === selectedModeId)?.label || selectedModeId}
            </span>
          )}
        </div>
        <div className="grid gap-2">
          {catalog.map((game) => {
            const selected = selectedGameId === game.id;
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => {
                  setSelectedGameId(game.id);
                  setSelectedModeId(game.modes[0]?.id || "classic");
                }}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-bg-card hover:border-border-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {game.emoji} {game.name}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">{game.description}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                      {game.minPlayers}–{game.maxPlayers} players
                    </p>
                  </div>
                  <span className={`text-sm font-black ${selected ? "text-accent" : "text-text-muted"}`}>
                    {selected ? "●" : "○"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {selectedGame && selectedGame.modes.length > 1 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {selectedGame.modes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={selectedModeId === mode.id}
                onClick={() => setSelectedModeId(mode.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedModeId === mode.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-bg-card hover:border-border-hover"
                }`}
              >
                <p className="text-xs font-bold text-white">{mode.label}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{mode.description}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {isHost ? (
        <div className="sticky bottom-4">
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={Boolean(disabledReason)}
            className="neon-btn neon-btn-purple min-h-14 w-full py-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {disabledReason || "Start game →"}
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-bg-card px-4 py-3 text-center text-xs font-semibold text-text-secondary">
          Waiting for the host to start the game…
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleLeave()}
        disabled={leaving}
        className="mx-auto mt-4 block py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted transition hover:text-white disabled:opacity-50"
      >
        {leaving ? "Leaving…" : "Leave room"}
      </button>
    </LobbyFrame>
  );
}
