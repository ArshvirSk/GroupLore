"use client";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, Chip, EmptyState, Input, Skeleton } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { GAME_CATEGORIES, gameMeta, type GameCategory } from "@/lib/gameMeta";
import { lobbyPath } from "@/lib/play";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type CatalogMode = { id: string; label: string; description: string };
type CatalogGame = {
  id: string;
  name: string;
  description: string;
  tag?: string;
  minPlayers: number;
  maxPlayers: number;
  modes: CatalogMode[];
};

const COLORS = ["purple", "lime", "pink", "cyan"];

function GamesView({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, isGuest } = useAuth();
  const [catalog, setCatalog] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<"All" | GameCategory>("All");
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in?next=/games");
      return;
    }
    api
      .getCatalog()
      .then((games: CatalogGame[]) => setCatalog(games))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the game library"))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, router]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((game) => {
      const meta = gameMeta(game.id);
      const matchesCategory = category === "All" || meta.category === category;
      const haystack = `${game.name} ${game.description} ${meta.category}`.toLowerCase();
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }, [catalog, category, query]);

  const playGame = async (gameId: string) => {
    if (starting) return;
    setStarting(gameId);
    setError("");
    try {
      const lobby = await api.createQuickLobby();
      router.push(`${lobbyPath(lobby)}?game=${encodeURIComponent(gameId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a room");
      setStarting(null);
    }
  };

  return (
    <AppShell active="games" search>
      <section className="page-hero mb-6">
        <div className="max-w-2xl">
          <p className="page-kicker"><Icon name="gamepad" className="h-3.5 w-3.5" /> The whole library</p>
          <h1 className="page-title">Browse Games</h1>
          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-ink/70">
            Social, writing, trivia and real-time games for every kind of group. Pick one and we&apos;ll open a room.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="primary">{catalog.length || "21"} games</Badge>
            <Badge tone="accent">3–12 players</Badge>
            <Badge tone="success">Instant rooms</Badge>
          </div>
        </div>
      </section>

      <Card className="mb-6 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-end">
          <Input label="Search the library" value={query} placeholder="Try bluff, trivia or two truths" onChange={(event) => setQuery(event.target.value)} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            <Chip active={category === "All"} onClick={() => setCategory("All")}>All</Chip>
            {GAME_CATEGORIES.map((item) => (
              <Chip key={item} active={category === item} onClick={() => setCategory(item)}>{item}</Chip>
            ))}
          </div>
        </div>
      </Card>

      {error ? <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="No games match that search"
          description="Try a broader word or switch back to all categories."
          action={<Button onClick={() => { setQuery(""); setCategory("All"); }}>Show every game</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((game, index) => {
            const meta = gameMeta(game.id);
            return (
              <button
                key={game.id}
                type="button"
                disabled={Boolean(starting) || isGuest}
                onClick={() => void playGame(game.id)}
                className={`game-library-card ${COLORS[index % COLORS.length]} text-left disabled:cursor-not-allowed disabled:opacity-60`}
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
                  <small>{game.minPlayers}–{game.maxPlayers} players · {game.modes.length} mode{game.modes.length === 1 ? "" : "s"}</small>
                  <span className="library-arrow">
                    {starting === game.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Icon name="arrow-right" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isGuest ? <p className="mt-4 text-sm text-muted">Create an account to start a room from the library.</p> : null}
    </AppShell>
  );
}

function GamesRoute() {
  const params = useSearchParams();
  const query = params.get("q") || "";
  return <GamesView key={query} initialQuery={query} />;
}

export default function GamesPage() {
  return (
    <Suspense fallback={<AppShell active="games" search><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56" />)}</div></AppShell>}>
      <GamesRoute />
    </Suspense>
  );
}
