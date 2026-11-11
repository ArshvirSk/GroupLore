"use client";

import { useAuth } from "@/components/AuthProvider";
import AppHeader from "@/components/ui/AppHeader";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  Chip,
  CodeInput,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { api } from "@/lib/api";
import { ensureLobby, lobbyPath } from "@/lib/play";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface GroupItem {
  id: string;
  name: string;
  role: "owner" | "member";
  lobby?: { id: string; code: string } | null;
}

interface ActivityPayload {
  gameType?: string;
  winner?: string | null;
  displayName?: string;
  prompt?: string;
  overrated?: number;
  underrated?: number;
  streak?: number;
  score?: number;
  [key: string]: unknown;
}

interface ActivityItem {
  id: string;
  group_id: string;
  user_id: string | null;
  event_type: string;
  payload: ActivityPayload;
  created_at: string;
  groups?: { name: string };
  profiles?: { display_name: string; avatar_url: string | null };
}

interface ActiveLobby {
  id: string;
  code: string;
  group_id: string | null;
  created_at: string;
  groups?: { name: string } | null;
}

interface BadgeItem {
  emoji: string;
  label: string;
}

interface PlayerStats {
  games_played: number;
  games_won: number;
  bluffs_successful: number;
  streak_best: number;
}

const EVENT_CONFIG: Record<string, { emoji: string; text: (p: ActivityPayload, user: string) => string }> = {
  game_started: { emoji: "🎮", text: (p, u) => `${u} started ${gameName(p.gameType)}` },
  game_finished: { emoji: "🏁", text: (p) => (p.winner ? `${p.winner} won ${gameName(p.gameType)}` : `${gameName(p.gameType)} finished`) },
  member_joined: { emoji: "👋", text: (_p, u) => `${u} joined the group` },
  member_left: { emoji: "💨", text: (_p, u) => `${u} left the group` },
  vote_result: { emoji: "📊", text: (p) => `“${p.prompt}” split the room` },
  impostor_caught: { emoji: "🔍", text: (_p, u) => `${u} was caught as the impostor` },
  impostor_survived: { emoji: "🕵️", text: (_p, u) => `${u} survived as the impostor` },
  streak_achieved: { emoji: "⚡", text: (p, u) => `${u} hit a ${p.streak}-answer streak` },
  high_score: { emoji: "🏆", text: (p, u) => `${u} scored ${p.score} points` },
  bluff_success: { emoji: "🎭", text: (_p, u) => `${u}'s bluff fooled everyone` },
  bluff_caught: { emoji: "🤥", text: (_p, u) => `${u}'s bluff was exposed` },
  most_likely_winner: { emoji: "👑", text: (p, u) => `${u} was voted most likely to “${p.prompt}”` },
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

function joinErrorMessage(message: string) {
  if (message.toLowerCase().includes("invalid join code")) {
    return "That code doesn’t match an open room. Check all 6 characters.";
  }
  return message || "Could not join that room. Try again.";
}

export default function DashboardPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, isGuest } = useAuth();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [activeLobbies, setActiveLobbies] = useState<ActiveLobby[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState<"groups" | "activity">("groups");
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupError, setGroupError] = useState("");
  const [creating, setCreating] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [playError, setPlayError] = useState("");
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    Promise.all([
      api.getMyGroups().catch(() => []),
      api.getFeed(20).catch(() => []),
      api.getActiveLobbies().catch(() => []),
      api.getMyStats().catch(() => ({ stats: null, badges: [] })),
    ])
      .then(([groupData, feedData, lobbies, summary]) => {
        setGroups(groupData);
        setFeed(feedData);
        setHasMore(feedData.length >= 20);
        setActiveLobbies(lobbies);
        setStats(summary.stats);
        setBadges(summary.badges || []);
      })
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const timer = window.setInterval(() => {
      api.getActiveLobbies().then(setActiveLobbies).catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [isLoaded, isSignedIn]);

  const loadMore = useCallback(() => {
    if (feedLoading || !hasMore || feed.length === 0) return;
    setFeedLoading(true);
    api.getFeed(20, feed[feed.length - 1].created_at)
      .then((more: ActivityItem[]) => {
        if (more.length < 20) setHasMore(false);
        setFeed((previous) => [...previous, ...more]);
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, [feed, feedLoading, hasMore]);

  const createGroup = async () => {
    if (creating) return;
    if (!newGroupName.trim()) {
      setGroupError("Give your group a name first.");
      return;
    }
    setCreating(true);
    setGroupError("");
    try {
      const group = await api.createGroup({ name: newGroupName.trim() });
      const lobby = await ensureLobby(group.id);
      router.push(lobbyPath(lobby));
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Could not create the group");
    } finally {
      setCreating(false);
    }
  };

  const openLobby = async (groupId: string) => {
    if (launching) return;
    setLaunching(groupId);
    setPlayError("");
    try {
      const lobby = await ensureLobby(groupId);
      router.push(lobbyPath(lobby));
    } catch (error) {
      setPlayError(error instanceof Error ? error.message : "Could not open the lobby");
    } finally {
      setLaunching(null);
    }
  };

  const quickPlay = async () => {
    if (joining) return;
    setJoining(true);
    setPlayError("");
    try {
      const lobby = await api.createQuickLobby();
      router.push(lobbyPath(lobby));
    } catch (error) {
      setPlayError(error instanceof Error ? error.message : "Could not start quick play");
    } finally {
      setJoining(false);
    }
  };

  const joinRoom = async () => {
    if (joining) return;
    if (code.length !== 6) {
      setCodeError("Enter the full 6-character code.");
      return;
    }
    setJoining(true);
    setCodeError("");
    try {
      const lobby = await api.joinLobby(code);
      router.push(lobbyPath(lobby));
    } catch (error) {
      setCodeError(joinErrorMessage(error instanceof Error ? error.message : ""));
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-[1120px] space-y-4 px-4 py-8 sm:px-6">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label text-primary">Your hub</p>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-[-0.04em] sm:text-6xl">Your hub</h1>
            <p className="mt-2 text-base text-muted">Pick up a live room or start something new.</p>
          </div>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.slice(0, 3).map((badge) => <Badge key={badge.label} tone="accent">{badge.emoji} {badge.label}</Badge>)}
            </div>
          ) : null}
        </div>

        {activeLobbies.length > 0 ? (
          <section className="mt-8" aria-labelledby="live-title">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-success" />
              <h2 id="live-title" className="font-display text-xl font-semibold">Live now</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {activeLobbies.map((lobby) => (
                <Card key={lobby.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <AvatarStack people={[{ name: lobby.groups?.name || "Quick play" }]} max={1} />
                    <div>
                    <p className="font-display text-lg font-bold">{lobby.groups?.name || "Quick play"}</p>
                    <p className="mt-1 font-mono text-sm font-bold text-muted">{lobby.code} · {timeAgo(lobby.created_at)}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => router.push(`/lobby/${lobby.code}`)}>Join now</Button>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]" aria-label="Start playing">
          <Card variant="raised" className="p-5">
            <p className="label text-muted">Primary actions</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Play with your people</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button size="lg" loading={joining} disabled={isGuest} onClick={() => void quickPlay()}>Play now</Button>
              <Button size="lg" variant="secondary" disabled={isGuest} onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cancel" : "New group"}</Button>
            </div>
            {isGuest ? <p className="mt-3 text-sm font-bold text-muted">Upgrade your guest account to create groups and quick lobbies.</p> : null}
            {showCreate ? (
              <div className="mt-5 border-t-[3px] border-border pt-4">
                <Input label="Group name" value={newGroupName} onChange={(event) => { setNewGroupName(event.target.value); setGroupError(""); }} placeholder="The Chaos Crew" maxLength={60} error={groupError} />
                <Button className="mt-3 w-full" loading={creating} onClick={() => void createGroup()}>Create group</Button>
              </div>
            ) : null}
            {playError ? <p role="alert" className="mt-3 rounded-[8px] border-2 border-danger bg-danger px-3 py-2 text-sm font-bold text-on-accent">{playError}</p> : null}
          </Card>

          <Card className="p-5">
            <p className="label text-muted">Join with a code</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Got an invite?</h2>
            <div className="mt-4">
              <CodeInput value={code} onChange={(value) => { setCode(value); setCodeError(""); }} onEnter={() => void joinRoom()} error={codeError} />
            </div>
            <Button className="mt-4 w-full" disabled={joining || code.length !== 6} loading={joining} onClick={() => void joinRoom()}>Join room</Button>
          </Card>
        </section>

        {stats && stats.games_played > 0 ? (
          <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Your stats">
            {[
              ["Games", stats.games_played],
              ["Wins", stats.games_won],
              ["Bluffs", stats.bluffs_successful],
              ["Best streak", stats.streak_best],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-4 text-center">
                <p className="font-mono text-3xl font-bold">{value}</p>
                <p className="label mt-1 text-muted">{label}</p>
              </Card>
            ))}
          </section>
        ) : null}

        <section className="mt-8">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "groups", label: `Groups (${groups.length})` }, { value: "activity", label: "Activity" }]} />
          <div className="mt-4">
            {tab === "groups" ? (
              groups.length === 0 ? (
                <EmptyState emoji="👥" title="No groups yet" description="Create a group, invite your friends, and your shared lore starts here." action={<Button onClick={() => setShowCreate(true)}>Create a group</Button>} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {groups.map((group) => (
                    <Card key={group.id} variant="interactive" className="p-5" onClick={() => router.push(`/group/${group.id}`)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-xl font-bold">{group.name}</h3>
                          <p className="mt-1 text-sm text-muted">{group.role === "owner" ? "You own this group" : "You’re a member"}</p>
                          <p className="mt-3 font-mono text-sm font-bold">{group.lobby?.code ? `Open room: ${group.lobby.code}` : "No open room"}</p>
                        </div>
                        <Chip>{group.lobby ? "Live" : "Idle"}</Chip>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t-[2px] border-border pt-3">
                        <span className="text-sm font-bold text-muted">{group.lobby ? "Jump into the lobby" : "Start a lobby"}</span>
                        <Button size="sm" variant={group.lobby ? "primary" : "secondary"} loading={launching === group.id} onClick={(event) => { event.stopPropagation(); void openLobby(group.id); }}>{group.lobby ? "Join" : "Open lobby"}</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            ) : feed.length === 0 ? (
              <EmptyState emoji="📜" title="Your lore feed is waiting" description="Play a game and the best moments will land here." action={<Button onClick={() => setTab("groups")}>Find a group</Button>} />
            ) : (
              <div className="grid gap-3">
                {feed.map((item) => {
                  const config = EVENT_CONFIG[item.event_type] || { emoji: "📌", text: () => item.event_type };
                  const name = item.profiles?.display_name || item.payload.displayName || "Someone";
                  return (
                    <Card key={item.id} className="flex items-start gap-3 p-4" onClick={() => router.push(`/group/${item.group_id}`)}>
                      <Avatar name={name} src={item.profiles?.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-snug"><span className="mr-2" aria-hidden>{config.emoji}</span>{config.text(item.payload, String(name))}</p>
                        <p className="mt-1 text-xs font-medium text-muted">{item.groups?.name || "Group"} · {timeAgo(item.created_at)}</p>
                      </div>
                    </Card>
                  );
                })}
                {hasMore ? <Button variant="ghost" loading={feedLoading} onClick={loadMore} className="mx-auto">Load more</Button> : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
