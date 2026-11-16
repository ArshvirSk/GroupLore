"use client";

import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, Input } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { gameMeta } from "@/lib/gameMeta";
import { lobbyPath } from "@/lib/play";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type LibraryGame = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  minPlayers: number;
  maxPlayers: number;
  modeCount: number;
  available: boolean;
  unavailableReason: string;
};

export default function GameLibrary({ games }: { games: LibraryGame[] }) {
  const router = useRouter();
  const { isSignedIn, isGuest } = useAuth();
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return games;
    return games.filter((game) => {
      const meta = gameMeta(game.id);
      return `${game.name} ${game.description} ${meta.category}`
        .toLowerCase()
        .includes(needle);
    });
  }, [games, query]);

  const playNow = async (game: LibraryGame) => {
    if (!game.available || starting) return;
    if (!isSignedIn || isGuest) {
      router.push("/sign-up?next=/library");
      return;
    }
    setStarting(game.id);
    setError("");
    try {
      const lobby = await api.createQuickLobby();
      router.push(`${lobbyPath(lobby)}?game=${encodeURIComponent(game.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a room");
      setStarting(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 max-w-2xl">
        <p className="page-kicker">
          <Icon name="gamepad" className="h-3.5 w-3.5" /> The full library
        </p>
        <h1 className="page-title">Find your next game</h1>
        <p className="mt-4 text-base font-medium leading-relaxed text-ink/70">
          Browse every GroupLore game in one place. Search, pick a title, and
          open a room with Play now.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="primary">{games.length} games</Badge>
          <Badge tone="accent">3–12 players</Badge>
          <Badge tone="success">Instant rooms</Badge>
        </div>
      </div>

      <Card className="mb-5 p-4">
        <Input
          label="Search games"
          value={query}
          placeholder="Try trivia, drawing, bluff or strategy"
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="mb-3 flex items-end justify-between gap-3 border-b border-border pb-3">
        <p className="text-sm font-semibold text-ink-soft">
          {filtered.length} {filtered.length === 1 ? "game" : "games"}
          {query.trim() ? ` matching “${query.trim()}”` : ""}
        </p>
        {!isSignedIn ? (
          <p className="text-xs font-medium text-muted">
            Sign in to start a room.
          </p>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Icon name="search" className="mx-auto h-8 w-8" />
          <h2 className="mt-3 font-display text-xl font-bold">
            No games match that search
          </h2>
          <p className="mt-1 text-sm text-muted">
            Try a broader word, or clear the search to see the whole library.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => setQuery("")}>
            Show every game
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((game) => {
            const meta = gameMeta(game.id);
            return (
              <Card
                key={game.id}
                className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center ${
                  game.available ? "" : "opacity-70"
                }`}
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-ink/20"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                >
                  <Icon name={meta.icon} className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl font-extrabold italic">
                    {game.name}
                  </h2>
                  <p className="mt-1 text-sm leading-snug text-ink/70">
                    {game.description}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-muted">
                    {meta.category} · {game.minPlayers}–{game.maxPlayers} players
                    {game.modeCount
                      ? ` · ${game.modeCount} mode${game.modeCount === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <Button
                  className="shrink-0"
                  disabled={!game.available || Boolean(starting)}
                  loading={starting === game.id}
                  onClick={() => void playNow(game)}
                >
                  {game.available ? "Play now" : "Coming soon"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
