"use client";

import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { ensureLobby, lobbyPath } from "@/lib/play";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type GroupItem = {
  id: string;
  name: string;
  role: "owner" | "member";
  lobby?: { id: string; code: string } | null;
};

type ActiveLobby = {
  id: string;
  code: string;
  groups?: { name: string } | null;
};

const GROUP_ICONS: IconName[] = ["globe", "sparkles", "smile", "star"];

export default function GroupsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, isGuest } = useAuth();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [lobbies, setLobbies] = useState<ActiveLobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in?next=/groups");
      return;
    }
    Promise.all([
      api.getMyGroups().catch(() => []),
      api.getActiveLobbies().catch(() => []),
    ])
      .then(([groupData, lobbyData]) => {
        setGroups(groupData);
        setLobbies(lobbyData);
      })
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (window.location.hash === "#create") setShowCreate(true);
  }, []);

  const createGroup = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const group = await api.createGroup({ name: name.trim() });
      const lobby = await ensureLobby(group.id);
      router.push(lobbyPath(lobby));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the group");
    } finally {
      setCreating(false);
    }
  };

  const openLobby = async (groupId: string) => {
    if (launching) return;
    setLaunching(groupId);
    setError("");
    try {
      const lobby = await ensureLobby(groupId);
      router.push(lobbyPath(lobby));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the lobby");
    } finally {
      setLaunching(null);
    }
  };

  return (
    <AppShell active="groups">
      <section className="page-hero mb-6">
        <div className="max-w-2xl">
          <p className="page-kicker"><Icon name="users" className="h-3.5 w-3.5" /> Your people</p>
          <h1 className="page-title">My Groups</h1>
          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-ink/70">
            Every crew has its own lore. Open a room, invite the group, and pick tonight&apos;s game.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button disabled={isGuest} onClick={() => setShowCreate((open) => !open)}>
              <Icon name="plus" className="h-4 w-4" /> {showCreate ? "Cancel" : "Create a group"}
            </Button>
            <Link href="/games" className="editorial-button inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-semibold text-ink">
              Browse games <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {showCreate ? (
        <Card id="create" className="mb-6 max-w-2xl p-5" variant="raised">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon name="plus" className="h-5 w-5" /></span>
            <div>
              <h2 className="font-display text-xl font-bold">Start a new group</h2>
              <p className="text-xs text-muted">Give it a name you will all recognize.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input label="Group name" value={name} maxLength={60} placeholder="Sunday dinner crew" onChange={(event) => { setName(event.target.value); setError(""); }} error={error || undefined} />
            </div>
            <Button loading={creating} disabled={!name.trim()} onClick={() => void createGroup()}>Create group</Button>
          </div>
        </Card>
      ) : null}

      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="label">Your crews</p>
          <h2 className="mt-1 font-display text-2xl font-bold italic">{groups.length} {groups.length === 1 ? "group" : "groups"}</h2>
        </div>
        {lobbies.length > 0 ? <Badge tone="success">{lobbies.length} room{lobbies.length === 1 ? "" : "s"} open</Badge> : null}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="users"
          title="Your first group starts here"
          description="Create a group, invite your friends, and every game night starts from the same place."
          action={<Button disabled={isGuest} onClick={() => setShowCreate(true)}>Create a group</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group, index) => (
            <article key={group.id} className={`color-card ${["purple", "lime", "pink", "cyan"][index % 4]} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="round-icon"><Icon name={GROUP_ICONS[index % GROUP_ICONS.length]} /></span>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-2xl font-extrabold italic">{group.name}</h3>
                    <p className="mt-1 text-xs font-semibold opacity-65">{group.role === "owner" ? "You own this group" : "You are a member"}</p>
                  </div>
                </div>
                <Link href={`/group/${group.id}`} className="round-icon" aria-label={`Open ${group.name}`}><Icon name="arrow-right" /></Link>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/15 pt-3">
                <span className="font-mono text-xs font-bold">{group.lobby?.code ? `Room ${group.lobby.code}` : "No open room"}</span>
                <Button size="sm" variant={group.lobby ? "primary" : "secondary"} loading={launching === group.id} onClick={() => void openLobby(group.id)}>
                  {group.lobby ? "Join room" : "Open lobby"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {lobbies.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-bold italic">Live rooms</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {lobbies.map((lobby) => (
              <Card key={lobby.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success"><Icon name="gamepad" className="h-5 w-5" /></span>
                  <div>
                    <p className="font-display font-bold">{lobby.groups?.name || "Quick play"}</p>
                    <p className="font-mono text-xs text-muted">{lobby.code}</p>
                  </div>
                </div>
                <Link href={`/lobby/${lobby.code}`} className="editorial-button inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-bold text-on-accent">Join</Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
