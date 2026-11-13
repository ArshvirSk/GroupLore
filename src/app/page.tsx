"use client";

import { useAuth } from "@/components/AuthProvider";
import AppHeader from "@/components/ui/AppHeader";
import {
  Badge,
  Button,
  Card,
  CodeInput,
  Input,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { gameMeta } from "@/lib/gameMeta";
import { ensureLobby, lobbyPath } from "@/lib/play";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

const FEATURED = [
  "most-likely-to",
  "guess-impostor",
  "caption-this",
  "hive-mind",
  "would-you-rather",
  "category-rush",
  "two-truths",
  "pitch-perfect",
];

const STEPS = [
  { title: "Gather your people", body: "Create a group or open a quick room and share the six-character code." },
  { title: "Pick tonight's game", body: "Choose from social, writing, trivia and real-time games for the whole table." },
  { title: "Leave with the lore", body: "Every round adds another story your group will bring up later." },
];

const START_ACTIONS: { key: "create" | "join" | "guest"; icon: IconName; title: string; body: string }[] = [
  { key: "create", icon: "users", title: "Create a group", body: "Open a room for your crew" },
  { key: "join", icon: "key", title: "Join a room", body: "Use a six-character code" },
  { key: "guest", icon: "user", title: "Try as a guest", body: "Jump in without an account" },
];

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError("Give your group a name first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const group = await api.createGroup({ name: groupName.trim() });
      const lobby = await ensureLobby(group.id);
      router.push(lobbyPath(lobby));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the group");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 6) {
      setError("Enter the full six-character code.");
      return;
    }
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const lobby = await api.joinLobby(joinCode);
      router.push(lobbyPath(lobby));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join that room");
    } finally {
      setLoading(false);
    }
  };

  const chooseMode = (next: "create" | "join") => {
    if (!isSignedIn) {
      router.push(next === "create" ? "/sign-up" : "/sign-in");
      return;
    }
    setError("");
    setMode(next);
  };

  return (
    <main className="min-h-screen">
      <AppHeader />
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-[1220px] px-4 py-4 sm:px-6 sm:py-5">
          <div className="dashboard-hero-row home-hero-row">
            <div className="reference-hero home-reference-hero">
              <div className="reference-hero-copy">
                <Image className="reference-wordmark" src="/assets/grouplore/wordmark-transparent.png" alt="GroupLore" width={401} height={158} priority />
                <h1 className="sr-only">GroupLore — real-time multiplayer party games, personalized for your friend group</h1>
                <p>Real-time multiplayer<br />party games, personalized<br />for your friend group.</p>
                <div className="home-hero-actions">
                  <Button size="lg" onClick={() => router.push(isSignedIn ? "/dashboard" : "/sign-up")}>
                    Play Now <Icon name="arrow-right" className="h-4 w-4" />
                  </Button>
                  <button type="button" className="reference-join-toggle" onClick={() => chooseMode("join")}>
                    Have a code? Join a room
                  </button>
                </div>
              </div>
              <Image className="reference-checker" src="/assets/grouplore/library-checker.png" alt="" aria-hidden width={178} height={45} priority />
              <Image className="reference-star" src="/assets/grouplore/chrome-star-clean.png" alt="" aria-hidden width={249} height={216} priority />
              <Image className="reference-burst" src="/assets/grouplore/library-starburst.png" alt="" aria-hidden width={137} height={120} priority />
            </div>

            <Card className="your-groups-panel home-start-panel">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="font-display text-lg font-bold">
                  {mode === "home" ? "Game night starts here" : mode === "create" ? "Create a group" : "Join a room"}
                </h2>
                {mode === "home" ? <Badge tone="primary">Free</Badge> : null}
              </div>

              {mode === "home" ? (
                <div className="home-start-list">
                  {START_ACTIONS.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className="home-start-row"
                      onClick={() => {
                        if (action.key === "guest") {
                          router.push("/guest");
                          return;
                        }
                        chooseMode(action.key);
                      }}
                    >
                      <span className="home-start-icon" aria-hidden><Icon name={action.icon} className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><b>{action.title}</b><small>{action.body}</small></span>
                      <Icon name="chevron-right" className="h-4 w-4" />
                    </button>
                  ))}
                  {isSignedIn ? (
                    <Button className="mt-2 w-full" variant="secondary" onClick={() => router.push("/dashboard")}>
                      <Icon name="home" className="h-4 w-4" /> Open my hub
                    </Button>
                  ) : null}
                  <p className="home-start-note">No downloads. Everyone plays on their phone.</p>
                </div>
              ) : (
                <div className="pt-4">
                  {mode === "create" ? (
                    <>
                      <p className="text-sm text-muted">You can invite everyone after the room opens.</p>
                      <div className="mt-4">
                        <Input
                          label="Group name"
                          value={groupName}
                          maxLength={60}
                          autoFocus
                          placeholder="Sunday dinner crew"
                          onChange={(event) => {
                            setGroupName(event.target.value);
                            setError("");
                          }}
                        />
                      </div>
                      <Button className="mt-3 w-full" loading={loading} onClick={() => void handleCreate()}>
                        Create and open lobby
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted">Enter the code your host shared with you.</p>
                      <div className="mt-4">
                        <CodeInput
                          value={joinCode}
                          onChange={(value) => {
                            setJoinCode(value);
                            setError("");
                          }}
                          onEnter={() => void handleJoin()}
                        />
                      </div>
                      <Button className="mt-3 w-full" disabled={joinCode.length !== 6} loading={loading} onClick={() => void handleJoin()}>
                        Join room
                      </Button>
                    </>
                  )}
                  {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
                  <Button className="mt-2 w-full" variant="ghost" onClick={() => { setMode("home"); setError(""); }}>
                    <Icon name="arrow-left" className="h-4 w-4" /> Back to start
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1220px] px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">A little something for everyone</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em]">Pick a game, any game</h2>
          </div>
          <Badge tone="primary">21 games and counting</Badge>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED.map((id) => {
            const meta = gameMeta(id);
            return (
              <div key={id} className={`color-card ${["purple", "lime", "pink", "cyan"][FEATURED.indexOf(id) % 4]} p-5`}>
                <span className="library-mark -rotate-3" aria-hidden><Icon name={meta.icon} /></span>
                <h3 className="mt-5 font-display text-2xl font-extrabold italic leading-none">{meta.name}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed opacity-70">{meta.description}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-surface/65 px-2.5 py-1 text-[10px] font-bold">{meta.category}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-[1220px] px-4 py-12 sm:px-6">
          <p className="label">How it works</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Card key={step.title} className="p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-mono text-sm font-bold text-primary">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
