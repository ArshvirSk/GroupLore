"use client";

import { useAuth } from "@/components/AuthProvider";
import AppHeader from "@/components/ui/AppHeader";
import UserMenu from "@/components/UserMenu";
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
import { gameMeta } from "@/lib/gameMeta";
import { ensureLobby, lobbyPath } from "@/lib/play";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [showJoinCode, setShowJoinCode] = useState(false);
  const gameScroller = useRef<HTMLDivElement>(null);

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
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
          <Link href="/dashboard" className="dashboard-brand"><Image src="/assets/grouplore/wordmark-transparent.png" alt="GroupLore" width={401} height={158} priority /></Link>
          <nav className="dashboard-nav">
            <a className="active" href="#home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg><span>Home</span></a>
            <a href="#groups"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.3A5.2 5.2 0 0 1 7.7 13h2.6a5.2 5.2 0 0 1 5.2 5.2V20zM16 4.8a3.4 3.4 0 0 1 0 6.4M17 14h.5a4 4 0 0 1 4 4v2h-4"/></svg><span>My Groups</span></a>
            <a href="#featured-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8.5h10a4.5 4.5 0 0 1 4.3 5.8l-1 3a2.4 2.4 0 0 1-3.8 1.1l-2.2-1.7H9.7l-2.2 1.7a2.4 2.4 0 0 1-3.8-1.1l-1-3A4.5 4.5 0 0 1 7 8.5Z"/><path d="M7 12v4m-2-2h4m7-1h.01M18 15h.01"/></svg><span>Browse Games</span></a>
            <a href="#stats"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v3a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4 0v5m-4 4h8m-7-4h6v4H9z"/></svg><span>Leaderboard</span></a>
            <a href="#activity"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h4l3-7 5 14 3-7h5"/></svg><span>Activity</span></a>
          </nav>
          <button className="dashboard-create" onClick={() => setShowCreate(true)}><span><b>Create a Group</b><small>Start a new crew!</small></span><i>+</i></button>
        </aside>
        <div className="dashboard-content" id="home">
          <div className="dashboard-tools">
            <div className="dashboard-toolbar">
              <Input label="Search games" aria-label="Search games" placeholder="⌕  Search games…" className="dashboard-search-input" />
              <a className="dashboard-notifications" href="#activity" aria-label="View recent activity">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
                {feed.length > 0 && <span aria-hidden="true" />}
              </a>
              <UserMenu />
            </div>
          </div>
          <div className="dashboard-heading">
            <div><p className="eyebrow mb-1">The friend group edition</p><h1 className="font-display text-3xl font-bold sm:text-4xl">Your GroupLore</h1><p className="mt-1 text-sm italic text-muted">Pick up where you left off, or make a new story.</p></div>
            {badges.length > 0 ? <div className="flex flex-wrap gap-2">{badges.slice(0, 3).map((badge) => <Badge key={badge.label} tone="accent">{badge.emoji} {badge.label}</Badge>)}</div> : null}
          </div>

          <section className="dashboard-hero-row" aria-label="Start playing">
            <div className="reference-hero">
              <div className="reference-hero-copy"><Image className="reference-wordmark" src="/assets/grouplore/wordmark-transparent.png" alt="GroupLore" width={401} height={158} priority /><p>Real-time multiplayer<br />party games, personalized<br />for your friend group.</p><Button size="lg" loading={joining} disabled={isGuest} onClick={() => void quickPlay()}>Play Now <span aria-hidden>➜</span></Button><button className="reference-join-toggle" onClick={() => setShowJoinCode((open) => !open)}>{showJoinCode ? "Hide room code" : "Have a code? Join a room"}</button>{showJoinCode && <div className="reference-join-form"><CodeInput value={code} onChange={(value) => { setCode(value); setCodeError(""); }} onEnter={() => void joinRoom()} error={codeError} /><Button size="sm" disabled={joining || code.length !== 6} loading={joining} onClick={() => void joinRoom()}>Join</Button></div>}</div>
              <Image className="reference-checker" src="/assets/grouplore/library-checker.png" alt="" aria-hidden width={178} height={45} priority />
              <Image className="reference-star" src="/assets/grouplore/chrome-star-clean.png" alt="" aria-hidden width={249} height={216} priority />
              <Image className="reference-burst" src="/assets/grouplore/library-starburst.png" alt="" aria-hidden width={137} height={120} priority />
            </div>
            <Card className="your-groups-panel" id="groups">
              <div className="flex items-center justify-between border-b border-border pb-3"><h2 className="font-display text-lg font-bold">Your Groups</h2><a className="text-sm font-semibold text-primary" href="#all-groups">See all →</a></div>
              {groups.length ? <div className="divide-y divide-border">{groups.slice(0, 3).map((group, index) => <Link key={group.id} href={`/group/${group.id}`} className="group-row"><span className={`group-stamp stamp-${index % 3}`} aria-hidden>{["◎", "✦", "☺"][index % 3]}</span><span className="min-w-0 flex-1"><b className="block truncate">{group.name}</b><small>{group.role === "owner" ? "Your group" : "Member"}{group.lobby ? " · Room open" : ""}</small></span><span className="text-xl">›</span></Link>)}</div> : <div className="py-5 text-sm text-muted">Your crew starts here. Create a group and invite your friends.</div>}
              <Button size="sm" variant="secondary" className="mt-3 w-full" disabled={isGuest} onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cancel" : "＋ Create a group"}</Button>
            </Card>
          </section>

          {showCreate && <Card className="mt-4 max-w-xl p-5"><Input label="Group name" value={newGroupName} onChange={(event) => { setNewGroupName(event.target.value); setGroupError(""); }} placeholder="The Chaos Crew" maxLength={60} error={groupError} /><Button className="mt-3" loading={creating} onClick={() => void createGroup()}>Create group</Button></Card>}
          {playError && <p role="alert" className="mt-3 rounded-[12px] bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{playError}</p>}
        <section className="mt-6" aria-labelledby="featured-title">
          <div className="mb-4 flex items-end gap-4"><h2 id="featured-title" className="font-display text-3xl font-bold">Featured Games</h2><div className="mb-2 hidden flex-1 border-t border-border sm:block" /></div>
          <div className="game-carousel">
            <button className="carousel-arrow carousel-prev" aria-label="Previous games" onClick={() => gameScroller.current?.scrollBy({ left: -460, behavior: "smooth" })}>‹</button>
            <div className="dashboard-games" ref={gameScroller}>
              {["most-likely-to", "guess-impostor", "five-second", "wavelength"].map((id) => {
                const meta = gameMeta(id);
                return <button key={id} type="button" className="dashboard-game-card editorial-card group relative overflow-hidden p-0 text-left transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70" aria-label={`Start ${meta.name}`} disabled={joining || isGuest} onClick={() => void quickPlay(id)}><Image src={`/assets/grouplore/${id}.png`} alt="" aria-hidden fill sizes="(max-width: 640px) 185px, (max-width: 900px) 195px, (max-width: 1100px) 220px, 266px" /></button>;
              })}
            </div>
            <button className="carousel-arrow carousel-next" aria-label="Next games" onClick={() => gameScroller.current?.scrollBy({ left: 460, behavior: "smooth" })}>›</button>
          </div>
        </section>

        <section id="activity" className="mt-7" aria-labelledby="activity-title">
          <div className="mb-3 flex items-end justify-between border-b border-border pb-3"><h2 id="activity-title" className="font-display text-2xl font-bold">Your Activity</h2><button className="text-sm font-semibold text-primary" onClick={() => { setTab("activity"); document.getElementById("all-groups")?.scrollIntoView({ behavior: "smooth" }); }}>See all →</button></div>
          {feed.length ? <div className="activity-strip">{feed.slice(0, 4).map((item) => { const config = EVENT_CONFIG[item.event_type] || { emoji: "📌", text: () => item.event_type }; const name = item.profiles?.display_name || item.payload.displayName || "Someone"; return <Card key={item.id} className="activity-pill"><span className="activity-icon" aria-hidden>{config.emoji}</span><span className="min-w-0 flex-1 truncate text-xs font-medium">{config.text(item.payload, String(name))}</span><small>{timeAgo(item.created_at)}</small></Card>; })}</div> : <p className="rounded-xl border border-border bg-surface px-4 py-5 text-sm text-muted">Your group moments will show up here after your first game.</p>}
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
                      <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                        <span className="text-sm font-medium text-muted">{group.lobby ? "Room is open" : "No open room"}</span>
                        <Button size="sm" variant={group.lobby ? "primary" : "secondary"} loading={launching === group.id} onClick={(event) => { event.stopPropagation(); void openLobby(group.id); }}>{group.lobby ? "Join" : "Open lobby"}</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            ) : feed.length === 0 ? (
              <EmptyState emoji="📜" title="Your lore feed is waiting" description="Play a game and the best moments will land here." action={<Button onClick={() => setTab("groups")}>Find a group</Button>} />
            ) : (
              <div id="activity-feed" className="grid gap-3">
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
        {activeLobbies.length > 0 && <section className="dashboard-live mt-8" aria-labelledby="live-title"><div className="mb-3 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-success" /><h2 id="live-title" className="font-display text-lg font-semibold">Live now</h2></div><div className="flex gap-3 overflow-x-auto pb-1">{activeLobbies.map((lobby) => <Card key={lobby.id} className="flex min-w-[300px] items-center justify-between gap-3 p-3"><div className="flex items-center gap-3"><AvatarStack people={[{ name: lobby.groups?.name || "Quick play" }]} max={1} /><div><p className="font-display font-bold">{lobby.groups?.name || "Quick play"}</p><p className="font-mono text-xs text-muted">{lobby.code} · {timeAgo(lobby.created_at)}</p></div></div><Button size="sm" onClick={() => router.push(`/lobby/${lobby.code}`)}>Join now</Button></Card>)}</div></section>}
        </div>
      </div>
    </main>
  );
}
