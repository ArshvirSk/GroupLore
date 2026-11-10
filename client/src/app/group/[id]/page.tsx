"use client";

import AvatarBubble from "@/components/AvatarBubble";
import FloatingBlobs from "@/components/FloatingBlobs";
import { api } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface MemberProfile {
  id: string;
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
  users: { id: string; name: string; clerk_id?: string };
}

interface Group {
  id: string;
  name: string;
  join_code: string;
  avatar_url?: string;
  group_members?: GroupMember[];
}

const ROAST_MESSAGES = [
  "Nice try, but you're not the boss here 😏",
  "Only the host has that power. Beg them.",
  "You? Start a game? That's adorable 🤭",
  "Access denied. Go pester the host.",
  "Skill issue: you're not the host 💀",
  "That button's just for decoration for you.",
  "The host controls the chaos, not you 👑",
  "Plot twist: you can't start games.",
  "Maybe ask the host nicely? With snacks? 🍕",
  "Host privileges required. You have none.",
  "L + ratio + not the host 💅",
  "Error 403: Insufficient vibes to start game.",
];

export default function GroupDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const { dbUserId } = useUserStore();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Player";
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roastMessage, setRoastMessage] = useState<string | null>(null);
  const [roastShake, setRoastShake] = useState(false);
  const [nudgeToasts, setNudgeToasts] = useState<
    { message: string; from: string; id: number }[]
  >([]);
  const [pokeCooldown, setPokeCooldown] = useState(false);
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
  const [saving, setSaving] = useState(false);

  // Determine host info from group_members
  const hostMember = group?.group_members?.find((m) => m.role === "host");
  const hostName = hostMember?.users?.name || "the host";

  // Check if current user is the host
  const isHost =
    group?.group_members?.some(
      (m) => m.role === "host" && m.user_id === dbUserId,
    ) ?? false;

  // Main data polling
  useEffect(() => {
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
  }, [id]);

  // Host polls for nudges
  useEffect(() => {
    if (!isHost || !group) return;
    const nudgeInterval = setInterval(async () => {
      try {
        const nudges = await api.getNudges(id);
        if (nudges && nudges.length > 0) {
          nudges.forEach((n: { message: string; from: string }) => {
            const toastId = Date.now() + Math.random();
            setNudgeToasts((prev) => [...prev, { ...n, id: toastId }]);
            setTimeout(() => {
              setNudgeToasts((prev) => prev.filter((t) => t.id !== toastId));
            }, 5000);
          });
        }
      } catch {}
    }, 3000);
    return () => clearInterval(nudgeInterval);
  }, [isHost, group, id]);

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

  const handleSaveMember = async () => {
    if (!form.displayName.trim()) return;
    setSaving(true);
    try {
      await api.upsertMember(id, {
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
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (m: MemberProfile) => {
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
      router.push("/");
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
    // If there's an active session, anyone can join it
    if (activeSession) {
      router.push(`/lobby/${activeSession.id}?groupId=${id}`);
      return;
    }
    if (!isHost) {
      if (pokeCooldown) return;
      // Send nudge to host AND show roast to self
      const msg =
        ROAST_MESSAGES[Math.floor(Math.random() * ROAST_MESSAGES.length)];
      setRoastMessage(msg);
      setRoastShake(true);
      setPokeCooldown(true);
      setTimeout(() => setRoastShake(false), 500);
      setTimeout(() => setRoastMessage(null), 3000);
      setTimeout(() => setPokeCooldown(false), 3000);
      try {
        await api.sendNudge(id, displayName || "Someone");
      } catch {}
      return;
    }
    try {
      const session = await api.createGame({
        groupId: id,
        gameType: "overrated-underrated",
      });
      router.push(`/lobby/${session.id}?groupId=${id}`);
    } catch {}
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

      {/* ── Nudge Toasts (Host sees these) ── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {nudgeToasts.map((toast) => (
            <motion.div
              key={toast.id}
              className="bg-bg-elevated border border-accent/30 rounded-2xl p-4 shadow-[0_8px_32px_rgba(37,99,235,0.2)]"
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="flex items-start gap-3">
                <motion.span
                  className="text-2xl"
                  animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  👉
                </motion.span>
                <div>
                  <p className="text-xs text-accent font-semibold uppercase tracking-wider">
                    {toast.from} poked you
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">
                    &quot;{toast.message}&quot;
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push("/")}
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
              onClick={handleLeaveGroup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all text-xs text-red-400 hover:text-red-300"
              whileTap={{ scale: 0.97 }}
            >
              Leave Group ✕
            </motion.button>
          </div>
        </motion.div>

        {/* Start Game */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            onClick={handleStartGame}
            className={`neon-btn text-sm px-10 py-4 ${activeSession ? "neon-btn-purple" : isHost ? "neon-btn-purple" : "neon-btn-outline"} ${pokeCooldown && !activeSession ? "opacity-50 cursor-wait" : ""}`}
            animate={roastShake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            {activeSession
              ? "Join Game →"
              : isHost
                ? "Start Game →"
                : `Poke ${hostName} to Start 👉`}
          </motion.button>

          {/* Roast message (non-host sees this) */}
          <AnimatePresence>
            {roastMessage && (
              <motion.div
                className="mt-3 px-4 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-center max-w-md"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <span className="text-text-secondary">{roastMessage}</span>
                <p className="text-text-muted text-xs mt-1">
                  Nudge sent to {hostName}!
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
                    className="glass-card p-4 cursor-pointer"
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
