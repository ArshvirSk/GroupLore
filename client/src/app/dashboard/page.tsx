"use client";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { EmojiIcon, Icon, type IconName } from "@/components/ui/Icon";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  CodeInput,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { api } from "@/lib/api";
import { gameMeta } from "@/lib/gameMeta";
import { ensureLobby, lobbyPath } from "@/lib/play";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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

interface CatalogGame {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  modes: { id: string; label: string; description: string }[];
}

const FEATURED_LIBRARY = [
  { id: "most-likely-to", color: "purple" },
  { id: "guess-impostor", color: "lime" },
  { id: "five-second", color: "pink" },
  { id: "wavelength", color: "cyan" },
] as const;

const EVENT_CONFIG: Record<string, { icon: IconName; text: (p: ActivityPayload, user: string) => string }> = {
  game_started: { icon: "gamepad", text: (p, u) => `${u} started ${gameName(p.gameType)}` },
  game_finished: { icon: "flag", text: (p) => (p.winner ? `${p.winner} won ${gameName(p.gameType)}` : `${gameName(p.gameType)} finished`) },
  member_joined: { icon: "hand", text: (_p, u) => `${u} joined the group` },
  member_left: { icon: "wind", text: (_p, u) => `${u} left the group` },
  vote_result: { icon: "chart", text: (p) => `“${p.prompt}” split the room` },
  impostor_caught: { icon: "search", text: (_p, u) => `${u} was caught as the impostor` },
  impostor_survived: { icon: "mask", text: (_p, u) => `${u} survived as the impostor` },
  streak_achieved: { icon: "zap", text: (p, u) => `${u} hit a ${p.streak}-answer streak` },
  high_score: { icon: "trophy", text: (p, u) => `${u} scored ${p.score} points` },
  bluff_success: { icon: "mask", text: (_p, u) => `${u}'s bluff fooled everyone` },
  bluff_caught: { icon: "eye", text: (_p, u) => `${u}'s bluff was exposed` },
  most_likely_winner: { icon: "crown", text: (p, u) => `${u} was voted most likely to “${p.prompt}”` },
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
  const [catalog, setCatalog] = useState<CatalogGame[]>([]);
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
  const [showJoinCode, setShowJoinCode] = useState(false);

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
      api.getCatalog().catch(() => [] as CatalogGame[]),
    ])
      .then(([groupData, feedData, lobbies, summary, gameCatalog]) => {
        setGroups(groupData);
        setFeed(feedData);
        setHasMore(feedData.length >= 20);
        setActiveLobbies(lobbies);
        setStats(summary.stats);
        setBadges(summary.badges || []);
        setCatalog(gameCatalog);
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

  const quickPlay = async (gameId?: string) => {
    if (joining) return;
    setJoining(true);
    setPlayError("");
    try {
      const lobby = await api.createQuickLobby();
      const destination = lobbyPath(lobby);
      router.push(gameId ? `${destination}?game=${encodeURIComponent(gameId)}` : destination);
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
      <AppShell active="home" search>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-80 w-full" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </div>
        </div>
      </AppShell>
    );
  }

  const groupIcons: IconName[] = ["globe", "sparkles", "smile"];

  return (
    <AppShell active="home" search>
      <div className="dashboard-content" id="home">
        <section className="dashboard-hero-row" aria-label="Start playing">
          <div className="reference-hero">
            <div className="reference-hero-copy">
              <Image className="reference-wordmark" src="/assets/grouplore/wordmark-transparent.png" alt="GroupLore" width={401} height={158} priority />
              <p>Real-time multiplayer<br />party games, personalized<br />for your friend group.</p>
              <Button size="lg" loading={joining} disabled={isGuest} onClick={() => void quickPlay()}>Play Now <Icon name="arrow-right" className="h-4 w-4" /></Button>
              <button className="reference-join-toggle" onClick={() => setShowJoinCode((open) => !open)}>{showJoinCode ? "Hide room code" : "Have a code? Join a room"}</button>
              {showJoinCode && <div className="reference-join-form"><CodeInput value={code} onChange={(value) => { setCode(value); setCodeError(""); }} onEnter={() => void joinRoom()} error={codeError} /><Button size="sm" disabled={joining || code.length !== 6} loading={joining} onClick={() => void joinRoom()}>Join</Button></div>}
            </div>
            <Image className="reference-checker" src="/assets/grouplore/library-checker.png" alt="" aria-hidden width={178} height={45} priority />
            <Image className="reference-star" src="/assets/grouplore/chrome-star-clean.png" alt="" aria-hidden width={249} height={216} priority />
            <Image className="reference-burst" src="/assets/grouplore/library-starburst.png" alt="" aria-hidden width={137} height={120} priority />
          </div>

          <Card className="your-groups-panel" id="groups">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display text-lg font-bold">Your Groups</h2>
              <Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary" href="/groups">See all <Icon name="arrow-right" className="h-3.5 w-3.5" /></Link>
            </div>
            {groups.length ? (
              <div className="divide-y divide-border">
                {groups.slice(0, 3).map((group, index) => (
                  <Link key={group.id} href={`/group/${group.id}`} className="group-row">
                    <span className={`group-stamp stamp-${index % 3}`} aria-hidden><Icon name={groupIcons[index % 3]} className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><b className="block truncate">{group.name}</b><small>{group.role === "owner" ? "Your group" : "Member"}{group.lobby ? " · Room open" : ""}</small></span>
                    <Icon name="chevron-right" className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-5 text-sm text-muted">Your crew starts here. Create a group and invite your friends.</div>
            )}
            <Button size="sm" variant="secondary" className="mt-3 w-full" disabled={isGuest} onClick={() => setShowCreate((value) => !value)}>
              <Icon name={showCreate ? "close" : "plus"} className="h-4 w-4" /> {showCreate ? "Cancel" : "Create a group"}
            </Button>
          </Card>
        </section>

        {badges.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.slice(0, 3).map((badge) => <Badge key={badge.label} tone="accent"><EmojiIcon value={badge.emoji} className="mr-1 h-3.5 w-3.5" /> {badge.label}</Badge>)}
          </div>
        ) : null}
        {showCreate ? (
          <Card className="mt-4 max-w-xl p-5">
            <Input label="Group name" value={newGroupName} onChange={(event) => { setNewGroupName(event.target.value); setGroupError(""); }} placeholder="The Chaos Crew" maxLength={60} error={groupError} />
            <Button className="mt-3" loading={creating} onClick={() => void createGroup()}>Create group</Button>
          </Card>
        ) : null}
        {playError ? <p role="alert" className="mt-3 rounded-[12px] bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{playError}</p> : null}

        <section className="mt-8" aria-labelledby="featured-title">
          <div className="mb-4 flex items-end gap-4">
            <h2 id="featured-title" className="font-display text-3xl font-bold italic">Featured Games</h2>
            <div className="mb-2 hidden flex-1 border-t border-border sm:block" />
            <Link href="/games" className="mb-1 hidden items-center gap-1 text-sm font-semibold text-primary sm:flex">Browse all <Icon name="arrow-right" className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="dashboard-library-grid">
            {FEATURED_LIBRARY.map(({ id, color }) => {
              const meta = gameMeta(id);
              const live = catalog.find((game) => game.id === id);
              const modes = live?.modes.length ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`Start ${live?.name || meta.name}`}
                  disabled={joining || isGuest}
                  onClick={() => void quickPlay(id)}
                  className={`game-library-card ${color} text-left disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="library-mark" aria-hidden><Icon name={meta.icon} /></span>
                    <span className="rounded-full border border-ink/15 bg-surface/60 px-2 py-1 text-[10px] font-bold">{meta.category}</span>
                  </span>
                  <span className="mt-4 block">
                    <span className="library-name block">{live?.name || meta.name}</span>
                    <span className="library-desc line-clamp-2 block">{live?.description || meta.description}</span>
                  </span>
                  <span className="library-foot">
                    <small>{live ? `${live.minPlayers}–${live.maxPlayers} players` : "3–12 players"}{modes ? ` · ${modes} mode${modes === 1 ? "" : "s"}` : ""}</small>
                    <span className="library-arrow"><Icon name="arrow-right" /></span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section id="activity" className="mt-8" aria-labelledby="activity-title">
          <div className="mb-3 flex items-end justify-between border-b border-border pb-3">
            <h2 id="activity-title" className="font-display text-2xl font-bold italic">Your Activity</h2>
            <Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary" href="/activity">See all <Icon name="arrow-right" className="h-3.5 w-3.5" /></Link>
          </div>
          {feed.length ? (
            <div className="activity-strip">
              {feed.slice(0, 4).map((item) => {
                const config = EVENT_CONFIG[item.event_type] || { icon: "pin" as IconName, text: () => item.event_type };
                const name = item.profiles?.display_name || item.payload.displayName || "Someone";
                return (
                  <Card key={item.id} className="activity-pill">
                    <span className="activity-icon" aria-hidden><Icon name={config.icon} className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{config.text(item.payload, String(name))}</span>
                    <small>{timeAgo(item.created_at)}</small>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-surface px-4 py-5 text-sm text-muted">Your group moments will show up here after your first game.</p>
          )}
        </section>

        {stats && stats.games_played > 0 ? (
          <section id="stats" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Your stats">
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

        <section id="all-groups" className="mt-8">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "groups", label: `Groups (${groups.length})` }, { value: "activity", label: "Activity" }]} />
          <div className="mt-4">
            {tab === "groups" ? (
              groups.length === 0 ? (
                <EmptyState icon="users" title="No groups yet" description="Create a group, invite your friends, and your shared lore starts here." action={<Button onClick={() => setShowCreate(true)}>Create a group</Button>} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {groups.map((group, index) => (
                    <div key={group.id} role="button" tabIndex={0} className={`color-card ${["purple", "lime", "pink", "cyan"][index % 4]} cursor-pointer p-5 text-left`} onClick={() => router.push(`/group/${group.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") router.push(`/group/${group.id}`); }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-2xl font-extrabold italic">{group.name}</h3>
                          <p className="mt-1 text-sm font-medium opacity-70">{group.role === "owner" ? "You own this group" : "You’re a member"}</p>
                          <p className="mt-3 font-mono text-sm font-bold">{group.lobby?.code ? `Room ${group.lobby.code}` : "No open room"}</p>
                        </div>
                        <span className="round-icon"><Icon name="arrow-right" /></span>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-ink/15 pt-3">
                        <span className="text-sm font-medium opacity-70">{group.lobby ? "Room is open" : "No open room"}</span>
                        <Button size="sm" variant={group.lobby ? "primary" : "secondary"} loading={launching === group.id} onClick={(event) => { event.stopPropagation(); void openLobby(group.id); }}>{group.lobby ? "Join" : "Open lobby"}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : feed.length === 0 ? (
              <EmptyState icon="book" title="Your lore feed is waiting" description="Play a game and the best moments will land here." action={<Button onClick={() => setTab("groups")}>Find a group</Button>} />
            ) : (
              <div id="activity-feed" className="grid gap-3">
                {feed.map((item) => {
                  const config = EVENT_CONFIG[item.event_type] || { icon: "pin" as IconName, text: () => item.event_type };
                  const name = item.profiles?.display_name || item.payload.displayName || "Someone";
                  return (
                    <Card key={item.id} className="flex items-start gap-3 p-4" onClick={() => router.push(`/group/${item.group_id}`)}>
                      <Avatar name={name} src={item.profiles?.avatar_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-bold leading-snug"><Icon name={config.icon} className="h-4 w-4 shrink-0" />{config.text(item.payload, String(name))}</p>
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

        {activeLobbies.length > 0 ? (
          <section className="dashboard-live mt-8" aria-labelledby="live-title">
            <div className="mb-3 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-success" /><h2 id="live-title" className="font-display text-lg font-semibold">Live now</h2></div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {activeLobbies.map((lobby) => (
                <Card key={lobby.id} className="flex min-w-[300px] items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3"><AvatarStack people={[{ name: lobby.groups?.name || "Quick play" }]} max={1} /><div><p className="font-display font-bold">{lobby.groups?.name || "Quick play"}</p><p className="font-mono text-xs text-muted">{lobby.code} · {timeAgo(lobby.created_at)}</p></div></div>
                  <Button size="sm" onClick={() => router.push(`/lobby/${lobby.code}`)}>Join now</Button>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
