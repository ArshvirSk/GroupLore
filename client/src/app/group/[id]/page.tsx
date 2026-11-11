"use client";

import AvatarBubble from "@/components/AvatarBubble";
import { useAuth } from "@/components/AuthProvider";
import FloatingBlobs from "@/components/FloatingBlobs";
import { api } from "@/lib/api";
import { copyInviteLink, ensureLobby } from "@/lib/play";
import { useUserStore } from "@/stores/userStore";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface MemberProfile {
  id: string;
  user_id?: string | null;
  display_name: string;
  nickname?: string;
  traits: string[];
  habits: string[];
  iconic_moments: string[];
  catchphrases: string[];
  most_likely_to: string[];
  avatar_url?: string;
}

interface GroupMember {
  user_id: string;
  role: string;
  users: { id: string; name: string };
}

interface Group {
  id: string;
  name: string;
  join_code: string;
  avatar_url?: string;
  group_members?: GroupMember[];
}

export default function GroupDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomClosed = searchParams.get("roomClosed") === "1";
  const { isLoaded, isSignedIn } = useAuth();
  const { dbUserId } = useUserStore();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [activeSession, setActiveSession] = useState<{ id: string } | null>(
    null,
  );

  const [form, setForm] = useState({
    displayName: "",
    nickname: "",
    traits: "",
    habits: "",
    iconicMoments: "",
    catchphrases: "",
    mostLikelyTo: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Determine host info from group_members
  const hostMember = group?.group_members?.find((m) => m.role === "host");
  const hostName = hostMember?.users?.name || "the host";

  // Check if current user is the host
  const isHost =
    group?.group_members?.some(
      (m) => m.role === "host" && m.user_id === dbUserId,
    ) ?? false;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  // Main data polling
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadData();
    const interval = setInterval(async () => {
      try {
        const [g, m] = await Promise.all([
          api.getGroup(id),
          api.getMembers(id),
        ]);
        setGroup(g);
        setMembers(m);
      } catch {}
      // Check for active lobby session (read-only)
      try {
        const session = await api.getActiveSession(id);
        if (session && session.status === "lobby") {
          setActiveSession(session);
        } else {
          setActiveSession(null);
        }
      } catch {
        setActiveSession(null);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, isLoaded, isSignedIn]);

  const loadData = async () => {
    try {
      const [g, m] = await Promise.all([api.getGroup(id), api.getMembers(id)]);
      setGroup(g);
      setMembers(m);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (group?.join_code) {
      navigator.clipboard.writeText(group.join_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const copyInvite = async () => {
    if (!group?.join_code) return;
    try {
      await copyInviteLink(group.join_code);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      alert("Could not copy the invite link");
    }
  };

  const handleSaveMember = async () => {
    if (!form.displayName.trim()) return;
    setSaving(true);
    try {
      await api.upsertMember(id, {
        userId: editingUserId || undefined,
        displayName: form.displayName.trim(),
        nickname: form.nickname.trim() || null,
        traits: form.traits
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        habits: form.habits
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        iconicMoments: form.iconicMoments
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        catchphrases: form.catchphrases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        mostLikelyTo: form.mostLikelyTo
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setShowAdd(false);
      setEditingId(null);
      setEditingUserId(null);
      setForm({
        displayName: "",
        nickname: "",
        traits: "",
        habits: "",
        iconicMoments: "",
        catchphrases: "",
        mostLikelyTo: "",
      });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (m: MemberProfile) => {
    const canEdit = isHost || (m.user_id && m.user_id === dbUserId);
    if (!canEdit) return;
    setEditingUserId(m.user_id || null);
    setForm({
      displayName: m.display_name,
      nickname: m.nickname || "",
      traits: m.traits.join(", "),
      habits: m.habits.join(", "),
      iconicMoments: m.iconic_moments.join(", "),
      catchphrases: m.catchphrases.join(", "),
      mostLikelyTo: m.most_likely_to.join(", "),
    });
    setEditingId(m.id);
    setShowAdd(true);
  };

  const handleLeaveGroup = async () => {
    if (!confirm("Are you sure you want to leave this group?")) return;
    try {
      await api.leaveGroup(id);
      router.push("/dashboard");
    } catch {
      alert("Failed to leave group");
    }
  };

  const handleRemoveMember = async (targetUserId: string, name: string) => {
    if (!confirm(`Remove ${name} from the group?`)) return;
    try {
      await api.removeMember(id, targetUserId);
      await loadData();
    } catch {
      alert("Failed to remove member");
    }
  };

  const handleStartGame = async () => {
    if (launching) return;
    setLaunching(true);
    setLaunchError("");
    try {
      const session = await ensureLobby(id);
      router.push(`/lobby/${session.id}?groupId=${id}`);
    } catch (err) {
      setLaunchError(
        err instanceof Error ? err.message : "Could not open the lobby",
      );
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12 relative">
      <FloatingBlobs />

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="text-text-muted hover:text-text-secondary text-xs uppercase tracking-wider mb-6 inline-block transition-colors"
          >
            ← Back
          </button>

          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">
            {group?.name || "Group"}
          </h1>

          {/* Host Badge + Join Code */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-muted border border-accent/20 text-xs"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="text-accent">👑</span>
              <span className="text-text-secondary">Host:</span>
              <span className="text-accent font-semibold">{hostName}</span>
            </motion.div>

            <motion.button
              onClick={copyCode}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-card border border-border hover:border-border-hover transition-all text-xs"
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-text-muted">Code:</span>
              <span className="text-accent font-mono font-bold tracking-widest">
                {group?.join_code}
              </span>
              <span className="text-text-muted">{codeCopied ? "✓" : "⎘"}</span>
            </motion.button>

            <motion.button
              onClick={() => void copyInvite()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 hover:border-accent/40 transition-all text-xs text-accent"
              whileTap={{ scale: 0.97 }}
            >
              {inviteCopied ? "Invite copied ✓" : "Copy invite link 🔗"}
            </motion.button>

            <motion.button
              onClick={handleLeaveGroup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all text-xs text-red-400 hover:text-red-300"
              whileTap={{ scale: 0.97 }}
            >
              Leave Group ✕
            </motion.button>
          </div>
        </motion.div>

        {roomClosed && !activeSession && (
          <motion.div
            role="status"
            className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            That room isn&apos;t currently open. Start a new lobby below to play.
          </motion.div>
        )}

        {/* Start Game */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            onClick={() => void handleStartGame()}
            disabled={launching}
            className="neon-btn neon-btn-purple text-sm px-10 py-4 disabled:opacity-50"
            whileTap={{ scale: 0.98 }}
          >
            {launching
              ? "Opening lobby…"
              : activeSession
                ? "Join Game →"
                : "Open Game Lobby →"}
          </motion.button>
          <p className="mt-3 max-w-md text-xs text-text-muted">
            Anyone in the group can open the lobby and start. Most games need at
            least 3 players, so share the invite link before you begin.
          </p>
          {launchError && (
            <p className="mt-3 max-w-md rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              {launchError}
            </p>
          )}
        </motion.div>

        {/* Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold tracking-tight uppercase text-text-secondary">
              Members{" "}
              <span className="text-text-muted">({members.length})</span>
            </h2>
            <button
              onClick={() => {
                setShowAdd(!showAdd);
                setEditingId(null);
                setEditingUserId(null);
                setForm({
                  displayName: "",
                  nickname: "",
                  traits: "",
                  habits: "",
                  iconicMoments: "",
                  catchphrases: "",
                  mostLikelyTo: "",
                });
              }}
              className="neon-btn neon-btn-outline text-xs px-4 py-2"
            >
              + Add
            </button>
          </div>

          {/* Form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div
                className="glass-card p-6 mb-5"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h3 className="font-bold text-sm tracking-tight uppercase text-text-secondary mb-4">
                  {editingId ? "Edit Member" : "New Member"}
                </h3>
                <div className="grid gap-2.5">
                  <input
                    className="neon-input"
                    placeholder="Display Name *"
                    value={form.displayName}
                    onChange={(e) =>
                      setForm({ ...form, displayName: e.target.value })
                    }
                  />
                  <input
                    className="neon-input"
                    placeholder="Nickname"
                    value={form.nickname}
                    onChange={(e) =>
                      setForm({ ...form, nickname: e.target.value })
                    }
                  />
                  <input
                    className="neon-input"
                    placeholder="Traits (comma-separated)"
                    value={form.traits}
                    onChange={(e) =>
                      setForm({ ...form, traits: e.target.value })
                    }
                  />
                  <input
                    className="neon-input"
                    placeholder="Habits (comma-separated)"
                    value={form.habits}
                    onChange={(e) =>
                      setForm({ ...form, habits: e.target.value })
                    }
                  />
                  <input
                    className="neon-input"
                    placeholder="Iconic Moments (comma-separated)"
                    value={form.iconicMoments}
                    onChange={(e) =>
                      setForm({ ...form, iconicMoments: e.target.value })
                    }
                  />
                  <input
                    className="neon-input"
                    placeholder="Catchphrases (comma-separated)"
                    value={form.catchphrases}
                    onChange={(e) =>
                      setForm({ ...form, catchphrases: e.target.value })
                    }
                  />
                  <input
                    className="neon-input"
                    placeholder="Most Likely To (comma-separated)"
                    value={form.mostLikelyTo}
                    onChange={(e) =>
                      setForm({ ...form, mostLikelyTo: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSaveMember}
                    className="neon-btn neon-btn-purple flex-1 text-xs"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAdd(false);
                      setEditingId(null);
                      setEditingUserId(null);
                    }}
                    className="neon-btn neon-btn-outline text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Members List */}
          {members.length === 0 ? (
            <div className="glass-card p-10 text-center text-text-muted text-sm">
              No members yet. Add profiles to personalize your games.
            </div>
          ) : (
            <div className="grid gap-2">
              {members.map((m, i) => {
                const memberIsHost =
                  group?.group_members?.some(
                    (gm) => gm.role === "host" && gm.user_id === m.id,
                  ) || hostMember?.users?.name === m.display_name;

                return (
                  <motion.div
                    key={m.id}
                    className={`glass-card p-4 ${
                      isHost || m.user_id === dbUserId
                        ? "cursor-pointer"
                        : "cursor-default"
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => startEditing(m)}
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBubble
                        name={m.display_name}
                        size="sm"
                        isHost={memberIsHost}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm tracking-tight flex items-center gap-1.5">
                          {m.display_name}
                          {m.nickname && (
                            <span className="text-text-muted font-normal">
                              &quot;{m.nickname}&quot;
                            </span>
                          )}
                          {memberIsHost && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-accent-muted text-accent border border-accent/20 uppercase tracking-wider font-medium">
                              Host
                            </span>
                          )}
                        </h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.traits?.slice(0, 3).map((t, j) => (
                            <span
                              key={j}
                              className="px-2 py-0.5 text-[10px] rounded-full bg-accent-muted text-accent border border-accent/20"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isHost && !memberIsHost && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const gm = group?.group_members?.find(
                                (gm) => gm.users?.name === m.display_name,
                              );
                              if (gm)
                                handleRemoveMember(gm.user_id, m.display_name);
                            }}
                            className="text-red-400/60 hover:text-red-400 text-xs transition-colors"
                            title="Remove from group"
                          >
                            ✕
                          </button>
                        )}
                        <span className="text-text-muted text-xs">Edit →</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
