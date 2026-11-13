"use client";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Icon, type IconName } from "@/components/ui/Icon";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/ui";
import { api, type Lobby, type LobbyPlayer } from "@/lib/api";
import { gameMeta, GAME_CATEGORIES, type GameCategory } from "@/lib/gameMeta";
import { copyInviteLink } from "@/lib/play";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function modeFeatures(mode: CatalogMode): { icon: IconName; label: string; value: string }[] {
  const text = `${mode.id} ${mode.label} ${mode.description}`.toLowerCase();
  const roundsMatch = mode.description.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,2}rounds?\b/i);
  const rounds = roundsMatch
    ? NUMBER_WORDS[roundsMatch[1].toLowerCase()] || Number(roundsMatch[1]) || null
    : null;
  const pace = /marathon|slow-burn|slow burn/.test(text)
    ? "Long"
    : /quick|speed|blitz|lightning|rapid|sudden/.test(text)
      ? "Fast"
      : "Standard";
  const twist = /anonymous|hidden/.test(text)
    ? "Anonymous votes"
    : /minority/.test(text)
      ? "Minority scores"
      : /double-agent|two impostors/.test(text)
        ? "Two impostors"
        : /sudden-death|eliminat/.test(text)
          ? "Elimination"
          : /no discussion/.test(text)
            ? "No discussion"
            : /marathon/.test(text)
              ? "Extra rounds"
              : /slow-burn|slow burn/.test(text)
                ? "Longer debate"
                : /quick|speed|blitz|lightning|rapid/.test(text)
                  ? "Faster timers"
                  : "Standard rules";
  const win = /impostor/.test(text)
    ? "Find the fake"
    : /spectrum|clue giver/.test(text)
      ? "Closest guess"
      : /banned word/.test(text)
        ? "Avoid bans"
        : /higher|lower/.test(text)
          ? "Correct calls"
          : /minority/.test(text)
            ? "Minority side"
            : /eliminat|last.*standing|sudden-death/.test(text)
              ? "Last standing"
              : /majority/.test(text)
                ? "Majority side"
                : /vote/.test(text)
                  ? "Most votes"
                  : /point|score|streak/.test(text)
                    ? "Most points"
                    : "Best answer";

  return [
    { icon: "sparkles", label: "Twist", value: twist },
    { icon: "target", label: "Rounds", value: rounds ? `${rounds} rounds` : "Multi-round" },
    { icon: "zap", label: "Pace", value: pace },
    { icon: "trophy", label: "Win by", value: win },
  ];
}

function Frame({ children, backHref, backLabel }: { children: ReactNode; backHref: string; backLabel: string }) {
  return (
    <AppShell active="games" contentClassName="pb-40 sm:pb-28">
      <div className="mb-3">
        <a href={backHref} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><Icon name="arrow-left" className="h-4 w-4" /> {backLabel}</a>
      </div>
      {children}
    </AppShell>
  );
}

function PlayerTile({ player, host, canKick, onKick }: { player: LobbyPlayer; host: boolean; canKick: boolean; onKick: () => void }) {
  return (
    <div className="relative flex min-w-0 flex-col items-center justify-center gap-2 rounded-[20px] border border-border bg-surface p-3 text-center">
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
  const setupRef = useRef<HTMLDivElement>(null);

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
    if (!isLoaded || !user) return;
    api.getCatalog().then((games: CatalogGame[]) => {
      setCatalog(games);
      const requestedId = new URLSearchParams(window.location.search).get("game");
      const requested = games.find((game) => game.id === requestedId);
      if (requested) {
        setSelectedGameId(requested.id);
        setSelectedModeId(requested.modes[0]?.id || "classic");
      }
    }).catch(() => {});
  }, [isLoaded, user]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const selectedGame = useMemo(() => catalog.find((game) => game.id === selectedGameId) || null, [catalog, selectedGameId]);
  const selectedMode = selectedGame?.modes.find((mode) => mode.id === selectedModeId) || selectedGame?.modes[0] || null;
  const features = selectedMode ? modeFeatures(selectedMode) : [];

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

  const selectGame = (game: CatalogGame) => {
    setSelectedGameId(game.id);
    setSelectedModeId(game.modes[0]?.id || "classic");
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => setupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

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
        <EmptyState icon="eye" title="Room unavailable" description={error || "That room code is not open."} action={<Button onClick={() => router.push("/dashboard")}>Back to hub</Button>} />
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
      <header className="page-hero">
        <div className="max-w-[62%] sm:max-w-[60%]">
          <p className="page-kicker"><Icon name="gamepad" className="h-3.5 w-3.5" /> {groupId ? "Group lobby" : "Quick play lobby"}</p>
          <h1 className="page-title break-words">{groupName}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isHost ? <Badge tone="accent"><Icon name="crown" className="mr-1 h-3.5 w-3.5" /> Host</Badge> : null}
            <Badge tone="success"><span className="mr-1 h-2 w-2 rounded-full bg-success" /> {connected} connected</Badge>
            {groupId ? <Button size="sm" variant="secondary" onClick={() => router.push(`/group/${groupId}`)}>Group page</Button> : null}
          </div>
        </div>
        <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="room-code-panel">
            <p className="label text-ink/70">Room code</p>
            <code className="mt-1 block">{lobby.code}</code>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <Button variant="secondary" onClick={() => void handleCopyCode()}><Icon name={codeCopied ? "check" : "link"} className="h-4 w-4" /> {codeCopied ? "Copied" : "Copy code"}</Button>
            <Button variant="secondary" onClick={() => void handleCopyInvite()}><Icon name={inviteCopied ? "check" : "users"} className="h-4 w-4" /> {inviteCopied ? "Invite copied" : "Copy invite"}</Button>
          </div>
        </div>
      </header>

      {isGuest ? (
        <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 border-primary p-4">
          <p className="text-sm font-bold">You’re playing as a guest. Save your progress to keep history.</p>
          <Button size="sm" onClick={() => router.push(`/upgrade?next=${encodeURIComponent(`/lobby/${lobby.code}`)}`)}>Save account</Button>
        </Card>
      ) : null}

      {error ? <p role="alert" className="mt-4 rounded-[12px] bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}

      {selectedGame && selectedMeta && selectedMode ? (
        <div ref={setupRef} className="mt-5 scroll-mt-24">
          <Card className="overflow-hidden" variant="raised">
            <div className="grid xl:grid-cols-[minmax(230px,0.9fr)_minmax(0,1.35fr)_minmax(220px,0.75fr)]">
              <div className="border-b border-border bg-primary-soft p-4 xl:border-b-0 xl:border-r">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] border border-ink/10 bg-surface/70" aria-hidden>
                    <Icon name={selectedMeta.icon} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="label text-primary">Game setup</p>
                    <h2 className="mt-1 truncate font-display text-xl font-bold leading-tight">{selectedGame.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="accent">{selectedMeta.category}</Badge>
                      <Badge>{selectedGame.minPlayers}–{selectedGame.maxPlayers} players</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-border p-4 xl:border-b-0 xl:border-r">
                <div className="flex items-center justify-between gap-2">
                  <p className="label text-ink">Choose a mode</p>
                  <span className="text-[10px] font-semibold text-muted">{selectedGame.modes.length} option{selectedGame.modes.length === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedGame.modes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={mode.id === selectedMode.id}
                      onClick={() => setSelectedModeId(mode.id)}
                      className={`min-h-9 rounded-full border px-3.5 text-xs font-bold transition-colors ${mode.id === selectedMode.id ? "border-ink bg-primary text-primary-ink shadow-[0_2px_0_var(--ink)]" : "border-border bg-surface text-ink hover:bg-surface-2"}`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden><Icon name="sparkles" className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">{selectedMode.label}</p>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-muted">{selectedMode.description || "The standard rules for this game."}</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-2/50 p-4">
                <p className="label text-ink">At a glance</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {features.map((feature) => (
                    <div key={feature.label} className="rounded-[10px] border border-border bg-surface p-2.5">
                      <span className="flex items-center gap-1.5 text-muted"><Icon name={feature.icon} className="h-3.5 w-3.5" /><span className="text-[9px] font-bold uppercase tracking-[.08em]">{feature.label}</span></span>
                      <p className="mt-1 text-xs font-bold leading-tight text-ink">{feature.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={`flex items-center gap-2 border-t border-border px-4 py-2 text-xs font-semibold ${disabledReason ? "bg-surface text-muted" : "bg-success/10 text-success"}`}>
              <Icon name={disabledReason ? "users" : "check"} className="h-4 w-4 flex-none" />
              <span>{disabledReason || "Everyone is here. Ready when you are."}</span>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <section aria-labelledby="players-title">
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

      <section aria-labelledby="games-title" className="min-w-0">
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
          <div className="mt-4"><EmptyState icon="search" title="No games match" description="Clear the search or choose another category." action={<Button size="sm" onClick={() => { setSearch(""); setCategory("All"); }}>Clear filters</Button>} /></div>
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
                  onClick={() => selectGame(game)}
                  className={`game-library-card ${["purple", "lime", "pink", "cyan"][filteredGames.indexOf(game) % 4]} ${selected ? "selected" : ""}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="library-mark" aria-hidden><Icon name={meta.icon} /></span>
                    <span className="rounded-full border border-ink/15 bg-surface/60 px-2 py-1 text-[10px] font-bold">{meta.category}</span>
                  </span>
                  <span className="mt-4 block">
                    <span className="library-name block">{game.name}</span>
                    <span className="library-desc line-clamp-2 block">{game.description}</span>
                  </span>
                  <span className="library-foot">
                    <small>{game.minPlayers}–{game.maxPlayers} players</small>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">{selected ? "Selected" : "Pick"} <span className="library-arrow"><Icon name={selected ? "check" : "arrow-right"} /></span></span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom))] z-40 border-t border-border bg-bg/95 px-4 pb-3 pt-3 shadow-[0_-8px_24px_rgba(35,24,47,.06)] backdrop-blur min-[901px]:bottom-0 min-[901px]:left-[245px] min-[901px]:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[1180px] items-center gap-2 sm:gap-3">
          <Button className="shrink-0" variant="ghost" size="sm" onClick={() => void handleLeave()} loading={leaving}>Leave</Button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="hidden h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-primary-soft text-primary sm:flex" aria-hidden>
              <Icon name={selectedMeta?.icon || "dice"} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold leading-tight">{selectedGame?.name || "Pick a game"}</p>
              <p className="truncate text-[10px] font-medium text-muted sm:text-xs">
                {selectedMode?.label || "No mode"} · {disabledReason || "Ready to start"}
              </p>
            </div>
          </div>
          {isHost ? (
            <Button className="shrink-0" size="md" loading={starting} disabled={Boolean(disabledReason)} onClick={() => void handleStart()}>
              {starting ? "Starting…" : "Start game"}
            </Button>
          ) : (
            <div className="flex min-h-11 shrink-0 items-center justify-center rounded-[12px] bg-surface-2 px-3 text-center text-xs font-medium text-muted sm:px-4 sm:text-sm">Waiting for host</div>
          )}
        </div>
      </div>
    </Frame>
  );
}
