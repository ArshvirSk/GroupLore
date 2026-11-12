"use client";

import AppHeader from "@/components/ui/AppHeader";
import { useAuth } from "@/components/AuthProvider";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { api, type Lobby, type LobbyPlayer } from "@/lib/api";
import { gameMeta, GAME_CATEGORIES, type GameCategory } from "@/lib/gameMeta";
import { copyInviteLink } from "@/lib/play";
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

function Frame({ children, backHref, backLabel }: { children: ReactNode; backHref: string; backLabel: string }) {
  return (
    <main className="min-h-screen pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <AppHeader backHref={backHref} backLabel={backLabel} />
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}

function PlayerTile({ player, host, canKick, onKick }: { player: LobbyPlayer; host: boolean; canKick: boolean; onKick: () => void }) {
  return (
    <div className="relative flex min-w-[132px] flex-1 flex-col items-center gap-2 rounded-[20px] border border-border bg-surface p-3 text-center">
      <Avatar name={player.display_name} host={host} connected={player.connected} size="lg" />
      <p className="w-full truncate font-display text-sm font-bold">{player.display_name}</p>
      <div className="flex flex-wrap justify-center gap-1">
        <Badge tone={player.connected ? "success" : "neutral"}>{player.connected ? "Ready" : "Offline"}</Badge>
        {player.is_guest ? <Badge>Guest</Badge> : null}
      </div>
      {canKick ? <button type="button" onClick={onKick} className="min-h-11 rounded-full px-3 text-xs font-semibold text-danger underline">Kick</button> : null}
    </div>
  );
}

export default function LobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const code = String(sessionId || "").toUpperCase();
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
  const [codeCopied, setCodeCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"All" | GameCategory>("All");

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
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [isLoaded, user, code, load, router]);

  useEffect(() => {
    api.getCatalog().then((games: CatalogGame[]) => {
      setCatalog(games);
      const requestedId = new URLSearchParams(window.location.search).get("game");
      const requested = games.find((game) => game.id === requestedId);
      if (requested) {
        setSelectedGameId(requested.id);
        setSelectedModeId(requested.modes[0]?.id || "classic");
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const selectedGame = useMemo(() => catalog.find((game) => game.id === selectedGameId) || null, [catalog, selectedGameId]);

  useEffect(() => {
    if (!selectedGame && catalog.length > 0) {
      setSelectedGameId(catalog[0].id);
      setSelectedModeId(catalog[0].modes[0]?.id || "classic");
    }
  }, [catalog, selectedGame]);

  const players = lobby?.lobby_players || [];
  const isHost = Boolean(lobby && user && lobby.host_id === user.id);
  const groupId = lobby?.group_id || "";
  const groupName = lobby?.groups?.name || "Quick play";
  const exitPath = groupId ? `/group/${groupId}` : "/dashboard";

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog.filter((game) => {
      const meta = gameMeta(game.id);
      const matchesCategory = category === "All" || meta.category === category;
      const matchesQuery = !query || `${game.name} ${game.description} ${meta.category}`.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [catalog, category, search]);

  const handleCopyCode = async () => {
    if (!lobby) return;
    try {
      await navigator.clipboard.writeText(lobby.code);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      setError("Could not copy the room code");
    }
  };

  const handleCopyInvite = async () => {
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
      const result = (await api.startLobby(lobby.id, { gameId: selectedGame.id, mode: selectedModeId })) as { sessionId: string };
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
      <Frame backHref="/dashboard" backLabel="Home">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Frame>
    );
  }

  if (!lobby) {
    return (
      <Frame backHref="/dashboard" backLabel="Home">
        <EmptyState emoji="🙈" title="Room unavailable" description={error || "That room code is not open."} action={<Button onClick={() => router.push("/dashboard")}>Back to hub</Button>} />
      </Frame>
    );
  }

  const connected = players.filter((player) => player.connected).length;
  let disabledReason = "";
  if (!selectedGame) disabledReason = "Pick a game first";
  else if (connected < selectedGame.minPlayers) disabledReason = `Need ${selectedGame.minPlayers - connected} more player${selectedGame.minPlayers - connected === 1 ? "" : "s"}`;
  else if (connected > selectedGame.maxPlayers) disabledReason = `This game allows ${selectedGame.maxPlayers} players`;
  else if (starting) disabledReason = "Starting…";

  const selectedMeta = selectedGame ? gameMeta(selectedGame.id) : null;
  const emptySeats = Math.max(0, (selectedGame?.minPlayers || 0) - players.length);

  return (
    <Frame backHref={exitPath} backLabel={groupId ? "Group" : "Home"}>
      <header>
        <p className="label text-primary">{groupId ? "Group lobby" : "Quick play lobby"}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">{groupName}</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="rounded-[20px] border border-primary/15 bg-primary-soft p-4 text-ink">
            <p className="label">Room code</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.18em] sm:text-4xl">{lobby.code}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <Button variant="ghost" onClick={() => void handleCopyCode()}>{codeCopied ? "Code copied" : "Copy code"}</Button>
            <Button variant="secondary" onClick={() => void handleCopyInvite()}>{inviteCopied ? "Invite copied" : "Copy invite"}</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isHost ? <Badge tone="accent">★ Host</Badge> : null}
          <Badge tone="success">{connected} connected</Badge>
          {groupId ? <Button size="sm" variant="ghost" onClick={() => router.push(`/group/${groupId}`)}>Group page</Button> : null}
        </div>
      </header>

      {isGuest ? (
        <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 border-primary p-4">
          <p className="text-sm font-bold">You’re playing as a guest. Save your progress to keep history.</p>
          <Button size="sm" onClick={() => router.push(`/upgrade?next=${encodeURIComponent(`/lobby/${lobby.code}`)}`)}>Save account</Button>
        </Card>
      ) : null}

      {error ? <p role="alert" className="mt-4 rounded-[12px] bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
      <section className="lg:sticky lg:top-24" aria-labelledby="players-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="players-title" className="font-display text-xl font-semibold">Players</h2>
          <span className="font-mono text-sm font-bold">{players.length}/{selectedGame?.maxPlayers || "—"}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {players.map((player) => (
            <PlayerTile key={player.user_id} player={player} host={player.user_id === lobby.host_id} canKick={isHost && player.user_id !== user?.id} onKick={() => void handleKick(player.user_id)} />
          ))}
          {Array.from({ length: emptySeats }).map((_, index) => (
            <div key={`waiting-${index}`} className="flex min-h-32 flex-col items-center justify-center rounded-[20px] border border-dashed border-border bg-surface p-3 text-center">
              <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full border-2 border-dashed border-border text-xl text-muted" aria-hidden>·</span>
              <p className="mt-2 text-center text-xs font-medium text-muted">Waiting for friends</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="games-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label text-primary">Game library</p>
            <h2 id="games-title" className="font-display text-2xl font-semibold">Pick a game</h2>
          </div>
          <span className="text-sm font-bold text-muted">{filteredGames.length} games</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input label="Search games" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or category" />
          <div className="flex items-end overflow-x-auto pb-1">
            <Chip active={category === "All"} onClick={() => setCategory("All")}>All</Chip>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {GAME_CATEGORIES.map((item) => <Chip key={item} active={category === item} onClick={() => setCategory(item)}>{item}</Chip>)}
        </div>

        {filteredGames.length === 0 ? (
          <div className="mt-4"><EmptyState emoji="🔎" title="No games match" description="Clear the search or choose another category." action={<Button size="sm" onClick={() => { setSearch(""); setCategory("All"); }}>Clear filters</Button>} /></div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredGames.map((game) => {
              const meta = gameMeta(game.id);
              const selected = game.id === selectedGameId;
              return (
                <button
                  key={game.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => { setSelectedGameId(game.id); setSelectedModeId(game.modes[0]?.id || "classic"); }}
                  className={`group overflow-hidden rounded-[20px] border bg-surface text-left shadow-soft transition-transform hover:-translate-y-px active:scale-[0.98] ${selected ? "border-2 border-primary ring-2 ring-primary/15" : "border-border"}`}
                >
                  <span className="block p-4">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className="flex h-11 w-11 -rotate-3 items-center justify-center rounded-[12px] text-2xl transition-transform group-hover:rotate-0"
                        style={{ background: `color-mix(in srgb, ${meta.color} 14%, var(--surface-2))` }}
                        aria-hidden
                      >{meta.emoji}</span>
                      <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold">{meta.category}</span>
                    </span>
                    <span className="mt-3 block font-display text-base font-bold">{game.name}</span>
                    <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted">{game.description}</span>
                    <span className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs font-medium text-muted">
                      <span>{game.minPlayers}–{game.maxPlayers} players</span>
                      <span>{selected ? "✓ Selected" : "Pick"}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selectedGame && selectedMeta ? (
          <Card className="mt-5 p-4" variant="raised">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl" aria-hidden>{selectedMeta.emoji}</span>
              <h3 className="font-display text-xl font-bold">{selectedGame.name}</h3>
              <Badge tone="accent">{selectedMeta.category}</Badge>
            </div>
            <div className="mt-4">
              {selectedGame.modes.length > 1 ? (
                <SegmentedControl label="Mode" value={selectedModeId} onChange={setSelectedModeId} options={selectedGame.modes.map((mode) => ({ value: mode.id, label: mode.label, description: mode.description }))} />
              ) : (
                <div>
                  <p className="label text-ink">Mode</p>
                  <p className="mt-1 rounded-[12px] border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-ink">{selectedGame.modes[0]?.label || "Classic"} — {selectedGame.modes[0]?.description || "The standard rules."}</p>
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-[1120px] items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => void handleLeave()} loading={leaving}>Leave</Button>
          {isHost ? (
            <Button className="flex-1" size="lg" loading={starting} disabled={Boolean(disabledReason)} onClick={() => void handleStart()}>{disabledReason || "Start game"}</Button>
          ) : (
            <div className="flex min-h-12 flex-1 items-center justify-center rounded-[12px] bg-surface-2 px-4 text-center text-sm font-medium text-muted">Waiting for the host to start…</div>
          )}
        </div>
      </div>
    </Frame>
  );
}
