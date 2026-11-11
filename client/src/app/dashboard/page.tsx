"use client";

import AvatarBubble from "@/components/AvatarBubble";
import { useAuth } from "@/components/AuthProvider";
import FloatingBlobs from "@/components/FloatingBlobs";
import UserMenu from "@/components/UserMenu";
import { api } from "@/lib/api";
import { ensureLobby } from "@/lib/play";
import { useUserStore } from "@/stores/userStore";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── Types ── */
interface GroupItem {
  id: string;
  name: string;
  join_code: string;
  role: string;
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
  users?: { name: string; avatar_url: string | null };
}

interface ActiveLobby {
  id: string;
  group_id: string;
  game_type: string;
  created_at: string;
  groups?: { name: string };
}

interface Badge {
  emoji: string;
  label: string;
}

interface PlayerStats {
  games_played: number;
  games_won: number;
  times_impostor: number;
  times_caught_as_impostor: number;
  times_survived_as_impostor: number;
  bluffs_attempted: number;
  bluffs_successful: number;
  total_votes_cast: number;
  most_likely_to_wins: number;
  streak_best: number;
}

interface PersonalityByGroup {
  groupName: string;
  displayName: string;
  traits: string[];
}

/* ── Event descriptions for the feed ── */
const EVENT_CONFIG: Record<
  string,
  {
    emoji: string;
    describe: (p: ActivityPayload, userName: string) => string;
  }
> = {
  game_started: {
    emoji: "🎮",
    describe: (p, u) => `${u} started a ${formatGameType(p.gameType || "")} game`,
  },
  game_finished: {
    emoji: "🏁",
    describe: (p) =>
      p.winner
        ? `${p.winner} won ${formatGameType(p.gameType || "")}!`
        : `${formatGameType(p.gameType || "")} finished`,
  },
  member_joined: {
    emoji: "👋",
    describe: (_p, u) => `${u} joined the group`,
  },
  member_left: {
    emoji: "💨",
    describe: (_p, u) => `${u} left the group`,
  },
  vote_result: {
    emoji: "📊",
    describe: (p) =>
      `"${p.prompt}" — ${p.overrated || 0} overrated, ${p.underrated || 0} underrated`,
  },
  impostor_caught: {
    emoji: "🔍",
    describe: (_p, u) => `${u} was caught as the impostor!`,
  },
  impostor_survived: {
    emoji: "🕵️",
    describe: (_p, u) => `${u} survived as the impostor`,
  },
  streak_achieved: {
    emoji: "⚡",
    describe: (p, u) => `${u} hit a ${p.streak}-answer streak!`,
  },
  high_score: {
    emoji: "🏆",
    describe: (p, u) => `${u} scored ${p.score} points`,
  },
  bluff_success: {
    emoji: "🎭",
    describe: (_p, u) => `${u}'s bluff fooled everyone`,
  },
  bluff_caught: {
    emoji: "🤥",
    describe: (_p, u) => `${u}'s bluff was exposed!`,
  },
  most_likely_winner: {
    emoji: "👑",
    describe: (p, u) => `${u} was voted most likely to "${p.prompt}"`,
  },
};

function formatGameType(type: string) {
  if (!type) return "a game";
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function joinErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid join code")) {
    return "That code doesn't match a room. Check the 6 characters and try again.";
  }
  if (normalized.includes("user not synced")) {
    return "Your account isn't ready yet. Refresh the page and try again.";
  }
  return "Could not join that room. Check your connection and try again.";
}

/* ── Stat card helper ── */
function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="glass-card p-3 text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-xl font-black tracking-tight mt-1">{value}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/*               THE HUB PAGE                 */
/* ═══════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, displayName } = useAuth();
  const { dbUserId } = useUserStore();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [activeLobbies, setActiveLobbies] = useState<ActiveLobby[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [personality, setPersonality] = useState<PersonalityByGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showIdentity, setShowIdentity] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "groups">("feed");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupError, setGroupError] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [launchingGroupId, setLaunchingGroupId] = useState<string | null>(null);
  const [playError, setPlayError] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [joinRoomError, setJoinRoomError] = useState("");

  const feedEndRef = useRef<HTMLDivElement>(null);

  /* ── Initial load ── */
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
      api
        .getMyStats()
        .catch(() => ({ stats: null, badges: [], personalityByGroup: [] })),
    ])
      .then(([g, f, lobbies, s]) => {
        setGroups(g);
        setFeed(f);
        setHasMore(f.length >= 20);
        setActiveLobbies(lobbies);
        setStats(s.stats);
        setBadges(s.badges || []);
        setPersonality(s.personalityByGroup || []);
      })
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, dbUserId]);

  /* ── Poll active lobbies every 10s ── */
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const interval = setInterval(() => {
      api
        .getActiveLobbies()
        .then(setActiveLobbies)
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [isLoaded, isSignedIn]);

  /* ── Infinite scroll for feed ── */
  const loadMore = useCallback(() => {
    if (feedLoading || !hasMore || feed.length === 0) return;
    setFeedLoading(true);
    const oldest = feed[feed.length - 1].created_at;
    api
      .getFeed(20, oldest)
      .then((more: ActivityItem[]) => {
        if (more.length < 20) setHasMore(false);
        setFeed((prev) => [...prev, ...more]);
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, [feed, feedLoading, hasMore]);

  const handleCreateGroup = async () => {
    if (creatingGroup) return;
    const name = newGroupName.trim();
    if (!name) {
      setGroupError("Give your group a name first.");
      return;
    }
    setCreatingGroup(true);
    setGroupError("");
    try {
      const group = await api.createGroup({ name });
      const session = await ensureLobby(group.id);
      router.push(`/lobby/${session.id}?groupId=${group.id}`);
    } catch (err) {
      setGroupError(
        err instanceof Error ? err.message : "Could not create the group",
      );
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleOpenLobby = async (groupId: string) => {
    if (launchingGroupId) return;
    setLaunchingGroupId(groupId);
    setPlayError("");
    try {
      const session = await ensureLobby(groupId);
      router.push(`/lobby/${session.id}?groupId=${groupId}`);
    } catch (err) {
      setPlayError(
        err instanceof Error ? err.message : "Could not open the lobby",
      );
    } finally {
      setLaunchingGroupId(null);
    }
  };

  const handleJoinRoom = async () => {
    if (joiningRoom) return;
    const code = joinRoomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinRoomError("Enter the 6-character room code.");
      return;
    }
    setJoiningRoom(true);
    setJoinRoomError("");
    try {
      const group = await api.joinGroup({ joinCode: code });
      const session = await api.getActiveSession(group.id).catch(() => null);
      if (!session) {
        router.push(`/group/${group.id}?roomClosed=1`);
        return;
      }
      router.push(`/lobby/${session.id}?groupId=${group.id}`);
    } catch (err) {
      setJoinRoomError(
        joinErrorMessage(err instanceof Error ? err.message : ""),
      );
    } finally {
      setJoiningRoom(false);
    }
  };

  /* ── Render ── */
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <motion.div
          className="text-text-muted text-sm"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading your hub...
        </motion.div>
      </main>
    );
  }

  const winRate = stats
    ? stats.games_played > 0
      ? Math.round((stats.games_won / stats.games_played) * 100)
      : 0
    : 0;

  return (
    <main className="min-h-screen px-4 py-8 relative">
      <FloatingBlobs />
      <div className="max-w-2xl mx-auto relative z-10">
        {/* ═══ Header ═══ */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-text-muted text-[10px] uppercase tracking-[0.2em]">
              The Hub
            </p>
            <UserMenu />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">
            {displayName}
          </h1>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {badges.map((b, i) => (
                <motion.span
                  key={i}
                  className="px-2.5 py-1 text-[10px] rounded-full bg-accent-muted border border-accent/20 text-accent font-medium"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  {b.emoji} {b.label}
                </motion.span>
              ))}
            </div>
          )}
        </motion.div>

        {/* ═══ Quick Play Bar ═══ */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="space-y-2">
            {activeLobbies.length > 0 && (
              <div className="glass-card p-4 border-accent/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-success">
                    Live Now
                  </span>
                </div>
                <div className="grid gap-2">
                  {activeLobbies.map((lobby) => (
                    <motion.button
                      key={lobby.id}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-bg-elevated/60 border border-border hover:border-accent/30 transition-all text-left"
                      onClick={() =>
                        router.push(
                          `/lobby/${lobby.id}?groupId=${lobby.group_id}`,
                        )
                      }
                      whileTap={{ scale: 0.98 }}
                    >
                      <div>
                        <p className="text-sm font-semibold tracking-tight">
                          {lobby.groups?.name || "Group"}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {formatGameType(lobby.game_type)} •{" "}
                          {timeAgo(lobby.created_at)}
                        </p>
                      </div>
                      <span className="neon-btn neon-btn-purple text-[10px] px-4 py-1.5">
                        Join →
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCreateGroup((open) => !open);
                  setGroupError("");
                }}
                className="neon-btn neon-btn-purple text-xs px-6 py-3 flex-1"
              >
                {showCreateGroup ? "Cancel" : "+ New Group"}
              </button>
              {groups.length > 0 && (
                <button
                  onClick={() => void handleOpenLobby(groups[0].id)}
                  disabled={Boolean(launchingGroupId)}
                  className="neon-btn neon-btn-outline text-xs px-6 py-3 disabled:opacity-50"
                >
                  {launchingGroupId ? "Opening…" : "Open Lobby →"}
                </button>
              )}
            </div>

            {showCreateGroup && (
              <div className="glass-card p-4">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Group name
                </label>
                <input
                  autoFocus
                  value={newGroupName}
                  onChange={(event) => {
                    setNewGroupName(event.target.value);
                    setGroupError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleCreateGroup();
                  }}
                  maxLength={60}
                  placeholder="The Chaos Crew"
                  className="neon-input mt-2 w-full"
                />
                {groupError && (
                  <p className="mt-2 text-xs font-semibold text-red-400">
                    {groupError}
                  </p>
                )}
                <button
                  onClick={() => void handleCreateGroup()}
                  disabled={creatingGroup}
                  className="neon-btn neon-btn-purple mt-3 w-full text-xs disabled:opacity-50"
                >
                  {creatingGroup ? "Creating…" : "Create group →"}
                </button>
              </div>
            )}

            <div className="glass-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Join with a room code
                  </p>
                  <p className="mt-0.5 text-[10px] text-text-muted">
                    Enter the 6-character code from the host.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-32 shrink-0">
                    <input
                      value={joinRoomCode}
                      onChange={(event) => {
                        setJoinRoomCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 6),
                        );
                        setJoinRoomError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void handleJoinRoom();
                      }}
                      disabled={joiningRoom}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      placeholder="ABC123"
                      aria-label="Room code"
                      aria-invalid={Boolean(joinRoomError)}
                      className="neon-input w-full text-center font-mono text-sm uppercase tracking-[0.2em] disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={() => void handleJoinRoom()}
                    disabled={joiningRoom || joinRoomCode.length !== 6}
                    aria-busy={joiningRoom}
                    className="neon-btn neon-btn-purple shrink-0 px-5 py-3 text-xs disabled:opacity-40"
                  >
                    {joiningRoom ? "Joining…" : "Join →"}
                  </button>
                </div>
              </div>
              {joinRoomError && (
                <p
                  role="alert"
                  className="mt-2 text-xs font-semibold text-red-300"
                >
                  {joinRoomError}
                </p>
              )}
            </div>

            {playError && (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                {playError}
              </p>
            )}
          </div>
        </motion.div>

        {/* ═══ Stats Row ═══ */}
        {stats && stats.games_played > 0 && (
          <motion.div
            className="grid grid-cols-4 gap-2 mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <StatBox icon="🎮" value={stats.games_played} label="Played" />
            <StatBox icon="🏆" value={`${winRate}%`} label="Win Rate" />
            <StatBox icon="🎭" value={stats.bluffs_successful} label="Bluffs" />
            <StatBox icon="⚡" value={stats.streak_best} label="Best Streak" />
          </motion.div>
        )}

        {/* ═══ Cross-Group Personality ═══ */}
        {personality.length > 1 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => setShowIdentity(!showIdentity)}
              className="w-full glass-card p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    🪪 Your Lore Identity
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    How different groups see you
                  </p>
                </div>
                <motion.span
                  className="text-text-muted text-xs"
                  animate={{ rotate: showIdentity ? 180 : 0 }}
                >
                  ▼
                </motion.span>
              </div>
            </button>
            <AnimatePresence>
              {showIdentity && (
                <motion.div
                  className="grid gap-2 mt-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {personality.map((p, i) => (
                    <motion.div
                      key={i}
                      className="glass-card p-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <p className="text-xs font-semibold text-accent mb-1">
                        {p.groupName}
                      </p>
                      <p className="text-[11px] text-text-secondary mb-1.5">
                        Known as{" "}
                        <span className="text-text-primary font-medium">
                          {p.displayName}
                        </span>
                      </p>
                      {p.traits.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {p.traits.map((t, j) => (
                            <span
                              key={j}
                              className="px-2 py-0.5 text-[9px] rounded-full bg-accent-muted text-accent border border-accent/20"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ Tab Bar: Feed / Groups ═══ */}
        <motion.div
          className="flex gap-1 mb-4 p-1 rounded-full bg-bg-card border border-border w-fit"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {(["feed", "groups"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab === "feed" ? "📜 Lore Feed" : `👥 Groups (${groups.length})`}
            </button>
          ))}
        </motion.div>

        {/* ═══ Feed Tab ═══ */}
        <AnimatePresence mode="wait">
          {activeTab === "feed" && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {feed.length === 0 ? (
                <div className="glass-card p-10 text-center">
                  <p className="text-2xl mb-2">📜</p>
                  <p className="text-text-muted text-sm">
                    No lore yet. Play some games to build your story!
                  </p>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {feed.map((item, i) => {
                    const config = EVENT_CONFIG[item.event_type] || {
                      emoji: "📌",
                      describe: () => item.event_type,
                    };
                    const userName =
                      item.users?.name ||
                      item.payload?.displayName ||
                      "Someone";

                    return (
                      <motion.div
                        key={item.id}
                        className="glass-card p-3.5 cursor-pointer hover:border-border-hover transition-all"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        onClick={() => router.push(`/group/${item.group_id}`)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg mt-0.5">{config.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary leading-snug">
                              {config.describe(
                                item.payload,
                                String(userName),
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-accent font-medium">
                                {item.groups?.name || "Group"}
                              </span>
                              <span className="text-[10px] text-text-muted">
                                {timeAgo(item.created_at)}
                              </span>
                            </div>
                          </div>
                          {item.users?.avatar_url && (
                            <AvatarBubble
                              name={userName}
                              avatarUrl={item.users.avatar_url}
                              size="sm"
                            />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Load more */}
                  {hasMore && (
                    <div ref={feedEndRef} className="text-center py-4">
                      <button
                        onClick={loadMore}
                        className="text-xs text-text-muted hover:text-accent transition-colors"
                        disabled={feedLoading}
                      >
                        {feedLoading ? "Loading..." : "Load more"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ Groups Tab ═══ */}
          {activeTab === "groups" && (
            <motion.div
              key="groups"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {groups.length === 0 ? (
                <div className="glass-card p-10 text-center text-text-muted text-sm">
                  No groups yet. Create one or join with a code.
                </div>
              ) : (
                <div className="grid gap-2">
                  {groups.map((g, i) => (
                    <motion.div
                      key={g.id}
                      className="glass-card p-5 cursor-pointer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => router.push(`/group/${g.id}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-base tracking-tight">
                            {g.name}
                          </h3>
                          <p className="text-xs text-text-muted mt-0.5">
                            <span className="font-mono text-accent">
                              {g.join_code}
                            </span>
                            {g.role === "host" && (
                              <span className="ml-2 text-text-secondary">
                                ★ Host
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleOpenLobby(g.id);
                          }}
                          disabled={Boolean(launchingGroupId)}
                          className="neon-btn neon-btn-purple shrink-0 text-[10px] px-4 py-1.5 disabled:opacity-50"
                        >
                          {launchingGroupId === g.id ? "Opening…" : "Play →"}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
