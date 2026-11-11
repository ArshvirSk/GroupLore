"use client";

import { useAuth } from "@/components/AuthProvider";
import AppHeader from "@/components/ui/AppHeader";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
} from "@/components/ui";
import { api } from "@/lib/api";
import { copyInviteLink, ensureLobby, lobbyPath } from "@/lib/play";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface MemberProfile {
  id: string;
  user_id?: string | null;
  role?: "owner" | "member";
  display_name: string;
  nickname?: string;
  traits: string[];
  habits: string[];
  iconic_moments: string[];
  catchphrases: string[];
  most_likely_to: string[];
  avatar_url?: string;
}

interface Group {
  id: string;
  name: string;
  role: "owner" | "member";
  owner_id?: string | null;
  avatar_url?: string;
  members?: MemberProfile[];
  lobby?: { id: string; code: string; status: string } | null;
}

const EMPTY_FORM = {
  displayName: "",
  nickname: "",
  traits: "",
  habits: "",
  iconicMoments: "",
  catchphrases: "",
  mostLikelyTo: "",
};

export default function GroupDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomClosed = searchParams.get("roomClosed") === "1";
  const { isLoaded, isSignedIn, user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [activeLobby, setActiveLobby] = useState<{ id: string; code: string } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const owner = group?.members?.find((member) => member.role === "owner");
  const hostName = owner?.display_name || "the owner";
  const isHost = group?.role === "owner";
  const joinCode = group?.lobby?.code || "";

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadData();
    const interval = window.setInterval(async () => {
      try {
        const next = await api.getGroup(id);
        setGroup(next);
        if (next.members) setMembers(next.members);
        setActiveLobby(next.lobby || null);
      } catch {}
    }, 3000);
    return () => window.clearInterval(interval);
  }, [id, isLoaded, isSignedIn]);

  const loadData = async () => {
    try {
      const next = await api.getGroup(id);
      setGroup(next);
      if (next.members) setMembers(next.members);
      setActiveLobby(next.lobby || null);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!joinCode) return;
    void navigator.clipboard.writeText(joinCode);
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyInvite = async () => {
    if (!joinCode) return;
    try {
      await copyInviteLink(joinCode);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      alert("Could not copy the invite link");
    }
  };

  const saveMember = async () => {
    if (!form.displayName.trim()) return;
    setSaving(true);
    try {
      await api.upsertMember(id, {
        userId: editingUserId || undefined,
        displayName: form.displayName.trim(),
        nickname: form.nickname.trim() || null,
        traits: form.traits.split(",").map((value) => value.trim()).filter(Boolean),
        habits: form.habits.split(",").map((value) => value.trim()).filter(Boolean),
        iconicMoments: form.iconicMoments.split(",").map((value) => value.trim()).filter(Boolean),
        catchphrases: form.catchphrases.split(",").map((value) => value.trim()).filter(Boolean),
        mostLikelyTo: form.mostLikelyTo.split(",").map((value) => value.trim()).filter(Boolean),
      });
      setShowAdd(false);
      setEditingId(null);
      setEditingUserId(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (member: MemberProfile) => {
    const canEdit = isHost || (member.user_id && member.user_id === user?.id);
    if (!canEdit) return;
    setEditingUserId(member.user_id || null);
    setForm({
      displayName: member.display_name,
      nickname: member.nickname || "",
      traits: (member.traits || []).join(", "),
      habits: (member.habits || []).join(", "),
      iconicMoments: (member.iconic_moments || []).join(", "),
      catchphrases: (member.catchphrases || []).join(", "),
      mostLikelyTo: (member.most_likely_to || []).join(", "),
    });
    setEditingId(member.id);
    setShowAdd(true);
  };

  const leaveGroup = async () => {
    if (!confirm("Leave this group?")) return;
    try {
      await api.leaveGroup(id);
      router.push("/dashboard");
    } catch {
      alert("Failed to leave group");
    }
  };

  const removeMember = async (targetUserId: string, name: string) => {
    if (!confirm(`Remove ${name} from the group?`)) return;
    try {
      await api.removeMember(id, targetUserId);
      await loadData();
    } catch {
      alert("Failed to remove member");
    }
  };

  const startGame = async () => {
    if (launching) return;
    setLaunching(true);
    setLaunchError("");
    try {
      const lobby = await ensureLobby(id);
      router.push(lobbyPath(lobby));
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Could not open the lobby");
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen">
        <AppHeader backHref="/dashboard" backLabel="Hub" />
        <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6">
          <div className="h-24 animate-pulse rounded-[20px] bg-surface-2" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AppHeader backHref="/dashboard" backLabel="Hub" onLeaveGroup={() => void leaveGroup()} />
      <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="eyebrow">Group</p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{group?.name || "Group"}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <AvatarStack people={members.map((member) => ({ name: member.display_name, src: member.avatar_url }))} />
              <span className="text-sm text-muted">{members.length} member{members.length === 1 ? "" : "s"} · Owner {hostName}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void startGame()} loading={launching}>{activeLobby ? "Open lobby" : "Open lobby"}</Button>
            <Button variant="secondary" disabled={!joinCode} onClick={() => void copyInvite()}>{inviteCopied ? "Invite copied" : "Invite"}</Button>
          </div>
        </header>

        {roomClosed && !activeLobby ? (
          <p role="status" className="mt-5 rounded-[12px] bg-warning/10 px-4 py-3 text-sm font-medium text-warning">That room isn’t open anymore. Start a new lobby to play.</p>
        ) : null}
        {launchError ? <p role="alert" className="mt-5 rounded-[12px] bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{launchError}</p> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-muted">Room code</p>
              <p className="font-mono text-2xl font-bold tracking-[0.12em]">{joinCode || "—"}</p>
            </div>
            <Button variant="ghost" size="sm" disabled={!joinCode} onClick={copyCode}>{codeCopied ? "Copied" : "Copy code"}</Button>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <Badge tone={activeLobby ? "success" : "neutral"}>{activeLobby ? "Live now" : "No open room"}</Badge>
          </Card>
        </div>

        <section className="mt-8" aria-labelledby="members-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="members-title" className="font-display text-2xl font-semibold">Members</h2>
            <Button size="sm" variant="secondary" onClick={() => { setShowAdd(true); setEditingId(null); setEditingUserId(null); setForm(EMPTY_FORM); }}>Add member</Button>
          </div>
          {members.length === 0 ? (
            <div className="mt-4"><EmptyState emoji="👋" title="Nobody here yet" description="Add a profile to start personalizing your games." action={<Button size="sm" onClick={() => setShowAdd(true)}>Add the first member</Button>} /></div>
          ) : (
            <div className="mt-4 divide-y divide-border rounded-[20px] border border-border bg-surface shadow-soft">
              {members.map((member) => {
                const memberIsHost = member.role === "owner";
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => startEditing(member)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <Avatar name={member.display_name} src={member.avatar_url} host={memberIsHost} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{member.display_name}{member.nickname ? <span className="font-normal text-muted"> “{member.nickname}”</span> : null}</p>
                      <p className="mt-0.5 text-xs text-muted">{[...member.traits].slice(0, 3).join(" · ") || "No traits yet"}</p>
                    </div>
                    <Badge tone={memberIsHost ? "accent" : "neutral"}>{memberIsHost ? "Owner" : "Member"}</Badge>
                    {isHost && !memberIsHost ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => { event.stopPropagation(); if (member.user_id) void removeMember(member.user_id, member.display_name); }}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); if (member.user_id) void removeMember(member.user_id, member.display_name); } }}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
                        aria-label={`Remove ${member.display_name}`}
                      >
                        ✕
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8" aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-display text-2xl font-semibold">Recent games</h2>
          <div className="mt-4"><EmptyState emoji="🎲" title="No games yet" description="Your recent sessions will appear here after your first game night." action={<Button size="sm" onClick={() => void startGame()}>Open a lobby</Button>} /></div>
        </section>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editingId ? "Edit member" : "Add member"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Display name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Alex" />
          <Input label="Nickname" value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="Optional" />
          <Input label="Traits" value={form.traits} onChange={(event) => setForm({ ...form, traits: event.target.value })} placeholder="Funny, competitive" hint="Comma separated" />
          <Input label="Habits" value={form.habits} onChange={(event) => setForm({ ...form, habits: event.target.value })} placeholder="Always late" hint="Comma separated" />
          <Input label="Iconic moments" value={form.iconicMoments} onChange={(event) => setForm({ ...form, iconicMoments: event.target.value })} placeholder="The karaoke night" />
          <Input label="Catchphrases" value={form.catchphrases} onChange={(event) => setForm({ ...form, catchphrases: event.target.value })} placeholder="Trust me" />
          <div className="sm:col-span-2"><Input label="Most likely to" value={form.mostLikelyTo} onChange={(event) => setForm({ ...form, mostLikelyTo: event.target.value })} placeholder="Start a group chat at 2am" /></div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1" loading={saving} onClick={() => void saveMember()} disabled={!form.displayName.trim()}>Save member</Button>
          <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
        </div>
      </Modal>
    </main>
  );
}
