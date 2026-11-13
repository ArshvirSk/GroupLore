"use client";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ActivityPayload = {
  gameType?: string;
  winner?: string | null;
  displayName?: string;
  prompt?: string;
  streak?: number;
  score?: number;
  [key: string]: unknown;
};

type FeedItem = {
  id: string;
  group_id: string;
  event_type: string;
  payload: ActivityPayload;
  created_at: string;
  groups?: { name: string };
  profiles?: { display_name: string; avatar_url: string | null };
};

const EVENTS: Record<string, { icon: IconName; text: (payload: ActivityPayload, user: string) => string }> = {
  game_started: { icon: "gamepad", text: (payload, user) => `${user} started ${gameName(payload.gameType)}` },
  game_finished: { icon: "flag", text: (payload) => (payload.winner ? `${payload.winner} won ${gameName(payload.gameType)}` : `${gameName(payload.gameType)} finished`) },
  member_joined: { icon: "hand", text: (_payload, user) => `${user} joined the group` },
  member_left: { icon: "wind", text: (_payload, user) => `${user} left the group` },
  vote_result: { icon: "chart", text: (payload) => `“${payload.prompt}” split the room` },
  impostor_caught: { icon: "search", text: (_payload, user) => `${user} was caught as the impostor` },
  impostor_survived: { icon: "mask", text: (_payload, user) => `${user} survived as the impostor` },
  streak_achieved: { icon: "zap", text: (payload, user) => `${user} hit a ${payload.streak}-answer streak` },
  high_score: { icon: "trophy", text: (payload, user) => `${user} scored ${payload.score} points` },
  bluff_success: { icon: "mask", text: (_payload, user) => `${user}'s bluff fooled everyone` },
  bluff_caught: { icon: "eye", text: (_payload, user) => `${user}'s bluff was exposed` },
  most_likely_winner: { icon: "crown", text: (payload, user) => `${user} was voted most likely to “${payload.prompt}”` },
};

function gameName(type?: string) {
  if (!type) return "a game";
  return type.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function timeAgo(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export default function ActivityPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in?next=/activity");
      return;
    }
    api
      .getFeed(50)
      .then((items) => setFeed(items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load activity"))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, router]);

  const groups = useMemo(() => {
    const table = new Map<string, FeedItem[]>();
    for (const item of feed) {
      const key = dayLabel(item.created_at);
      table.set(key, [...(table.get(key) || []), item]);
    }
    return [...table.entries()];
  }, [feed]);

  const gameCount = feed.filter((item) => item.event_type === "game_finished").length;

  return (
    <AppShell active="activity">
      <section className="page-hero mb-6">
        <div className="max-w-2xl">
          <p className="page-kicker"><Icon name="activity" className="h-3.5 w-3.5" /> The group chat, but useful</p>
          <h1 className="page-title">Activity</h1>
          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-ink/70">
            Every win, bluff, streak and questionable vote from your groups, in one place.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="primary">{feed.length} {feed.length === 1 ? "moment" : "moments"}</Badge>
            <Badge tone="accent">{gameCount} finished games</Badge>
          </div>
        </div>
      </section>

      {error ? <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p> : null}

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24" />)}
        </div>
      ) : feed.length === 0 ? (
        <EmptyState
          icon="activity"
          title="The lore feed is waiting"
          description="Play a game with one of your groups and the best moments will start showing up here."
          action={<Link href="/games" className="editorial-button inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-on-accent">Find a game</Link>}
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-7">
            {groups.map(([day, items]) => (
              <section key={day} aria-label={day}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-display text-lg font-bold italic">{day}</h2>
                  <span className="h-px flex-1 bg-border" />
                  <span className="label">{items.length}</span>
                </div>
                <div className="grid gap-3">
                  {items.map((item) => {
                    const config = EVENTS[item.event_type] || { icon: "pin" as IconName, text: () => item.event_type.replaceAll("_", " ") };
                    const name = item.profiles?.display_name || item.payload.displayName || "Someone";
                    return (
                      <Link key={item.id} href={`/group/${item.group_id}`} className="block">
                        <Card className="flex items-start gap-3 p-4 transition-colors hover:bg-surface-2">
                          <Avatar name={name} src={item.profiles?.avatar_url} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-start gap-2 text-sm font-bold leading-snug">
                              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon name={config.icon} className="h-3.5 w-3.5" /></span>
                              <span>{config.text(item.payload, String(name))}</span>
                            </p>
                            <p className="mt-1.5 text-xs font-medium text-muted">{item.groups?.name || "Group"} · {timeAgo(item.created_at)}</p>
                          </div>
                          <Icon name="chevron-right" className="mt-1 h-4 w-4 shrink-0 text-muted" />
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            <Card className="p-5">
              <h2 className="font-display text-xl font-bold">Your groups</h2>
              <p className="mt-1 text-xs text-muted">Every moment above comes from one of these crews.</p>
              <div className="mt-4 space-y-2">
                {[...new Map(feed.map((item) => [item.group_id, item.groups?.name || "Group"])).entries()].map(([id, name]) => (
                  <Link key={id} href={`/group/${id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 text-sm font-semibold hover:bg-surface-2">
                    <span className="truncate">{name}</span>
                    <Icon name="arrow-right" className="h-4 w-4 shrink-0" />
                  </Link>
                ))}
              </div>
            </Card>
            <Card className="bg-primary-soft p-5">
              <h2 className="font-display text-xl font-bold">Make some lore</h2>
              <p className="mt-2 text-sm text-ink/70">The feed is better after a game. Grab your group and start a room.</p>
              <Link href="/games" className="editorial-button mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-on-accent">Browse games</Link>
            </Card>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
