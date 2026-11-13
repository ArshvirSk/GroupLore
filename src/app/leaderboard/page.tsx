"use client";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { EmojiIcon, Icon, type IconName } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Stats = {
  games_played: number;
  games_won: number;
  bluffs_successful: number;
  streak_best: number;
};

type BadgeItem = { emoji: string; label: string };

type FeedItem = {
  id: string;
  event_type: string;
  created_at: string;
  groups?: { name: string };
  profiles?: { display_name: string; avatar_url: string | null };
  payload: { gameType?: string; winner?: string | null; [key: string]: unknown };
};

type Champion = { name: string; wins: number; lastWin: string };

function timeAgo(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in?next=/leaderboard");
      return;
    }
    Promise.all([
      api.getMyStats(),
      api.getFeed(50),
    ])
      .then(([summary, activity]) => {
        setStats(summary.stats || null);
        setBadges(summary.badges || []);
        setFeed(activity);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the leaderboard"))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, router]);

  const champions = useMemo<Champion[]>(() => {
    const table = new Map<string, Champion>();
    for (const item of feed) {
      const winner = item.payload?.winner?.trim();
      if (item.event_type !== "game_finished" || !winner) continue;
      const existing = table.get(winner);
      if (existing) {
        existing.wins += 1;
        if (item.created_at > existing.lastWin) existing.lastWin = item.created_at;
      } else {
        table.set(winner, { name: winner, wins: 1, lastWin: item.created_at });
      }
    }
    return [...table.values()].sort((a, b) => b.wins - a.wins || b.lastWin.localeCompare(a.lastWin));
  }, [feed]);

  const recentWins = feed.filter((item) => item.event_type === "game_finished" && item.payload?.winner).slice(0, 6);
  const winRate = stats?.games_played ? Math.round((stats.games_won / stats.games_played) * 100) : 0;
  const summary: { label: string; value: string | number; icon: IconName }[] = [
    { label: "Games played", value: stats?.games_played ?? 0, icon: "gamepad" },
    { label: "Wins", value: stats?.games_won ?? 0, icon: "trophy" },
    { label: "Win rate", value: `${winRate}%`, icon: "chart" },
    { label: "Best streak", value: stats?.streak_best ?? 0, icon: "zap" },
  ];

  return (
    <AppShell active="leaderboard">
      <section className="page-hero mb-6">
        <div className="max-w-2xl">
          <p className="page-kicker"><Icon name="trophy" className="h-3.5 w-3.5" /> Bragging rights</p>
          <h1 className="page-title">Leaderboard</h1>
          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-ink/70">
            The wins, the streaks and the people who will absolutely bring it up again.
          </p>
        </div>
      </section>

      {error ? <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.map((item) => (
              <Card key={item.label} className="p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon name={item.icon} className="h-4 w-4" /></span>
                <p className="mt-3 font-mono text-3xl font-bold leading-none">{item.value}</p>
                <p className="label mt-2">{item.label}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section aria-labelledby="champions-title">
              <div className="mb-3 flex items-end justify-between gap-3 border-b border-border pb-3">
                <h2 id="champions-title" className="font-display text-2xl font-bold italic">Group champions</h2>
                <Badge tone="primary">Last 50 moments</Badge>
              </div>
              {champions.length === 0 ? (
                <EmptyState
                  icon="trophy"
                  title="No champions yet"
                  description="Finish a game and the first winner takes the top spot."
                  action={<Link href="/games" className="editorial-button inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-on-accent">Find a game</Link>}
                />
              ) : (
                <div className="grid gap-3">
                  {champions.map((champion, index) => (
                    <Card key={champion.name} className={`flex items-center gap-4 p-4 ${index === 0 ? "border-primary bg-primary-soft" : ""}`}>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-lg font-bold ${index === 0 ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink"}`}>
                        {index + 1}
                      </span>
                      <Avatar name={champion.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-bold">{champion.name}</p>
                        <p className="text-xs text-muted">Last win {timeAgo(champion.lastWin)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-2xl font-bold leading-none">{champion.wins}</p>
                        <p className="label mt-1">wins</p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl font-bold">Your record</h2>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent"><Icon name="trophy" className="h-5 w-5" /></span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {stats?.games_played
                    ? `You have won ${stats.games_won} of ${stats.games_played} games. That is a ${winRate}% win rate.`
                    : "Play your first game to start your record."}
                </p>
                {badges.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <Badge key={badge.label} tone="accent"><EmojiIcon value={badge.emoji} className="mr-1 h-3.5 w-3.5" /> {badge.label}</Badge>
                    ))}
                  </div>
                ) : null}
                <Button className="mt-5 w-full" onClick={() => router.push("/games")}>Play another game</Button>
              </Card>

              <Card className="p-5">
                <h2 className="font-display text-xl font-bold">Recent wins</h2>
                {recentWins.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No finished games in the feed yet.</p>
                ) : (
                  <div className="mt-2 divide-y divide-border">
                    {recentWins.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-ink"><Icon name="crown" className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.payload.winner}</p>
                          <p className="truncate text-xs text-muted">{item.groups?.name || "Group"} · {timeAgo(item.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </aside>
          </div>
        </>
      )}
    </AppShell>
  );
}
