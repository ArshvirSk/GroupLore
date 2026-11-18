"use client";

import { useAuth } from "@/components/AuthProvider";
import DailyChallenge from "@/components/DailyChallenge";
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

const DAILY_GAMES = [
  { id: "blur-guess", name: "Blur Guess", description: "Five shared images", icon: "image" as const },
  { id: "connections", name: "Connections", description: "One shared board", icon: "puzzle" as const },
];

const SAFETY: { icon: IconName; title: string; body: string }[] = [
  { icon: "shield", title: "Invite-only rooms", body: "Every room is reached through its code. There is no public lobby to stumble into." },
  { icon: "ban", title: "Host moderation", body: "Mute, kick or block a player. Reports are saved server-side, not just hidden on screen." },
  { icon: "scale", title: "Content settings", body: "Family, teen and mature prompt banks, with a deployment-wide ceiling and an NSFW gate." },
  { icon: "lock", title: "Private group data", body: "Rooms are server-authoritative, database access stays server-side, and lore is generated locally." },
];

const START_ACTIONS: { key: "create" | "join" | "guest"; icon: IconName; title: string; body: string }[] = [
  { key: "create", icon: "users", title: "Create a group", body: "Open a room for your crew" },
  { key: "join", icon: "key", title: "Join a room", body: "Use a six-character code" },
  { key: "guest", icon: "user", title: "Try as a guest", body: "Jump in without an account" },
];

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn, isGuest } = useAuth();
  const [mode, setMode] = useState<"home" | "create" | "join">("home");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [dailyError, setDailyError] = useState("");
  const [dailyStarting, setDailyStarting] = useState<string | null>(null);
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

  const startDaily = async (gameId: string) => {
    if (!isSignedIn || isGuest) {
      router.push("/sign-up");
      return;
    }
    if (dailyStarting) return;
    setDailyStarting(gameId);
    setDailyError("");
    try {
      const lobby = await api.createQuickLobby();
      router.push(
        `${lobbyPath(lobby)}?game=${encodeURIComponent(gameId)}&mode=daily`,
      );
    } catch (err) {
      setDailyError(
        err instanceof Error ? err.message : "Could not open the daily room",
      );
      setDailyStarting(null);
    }
  };

  return (
    <main className="min-h-screen">
      <AppHeader />
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-[1220px] px-4 py-4 sm:px-6 sm:py-5">
          <div className="dashboard-hero-row home-hero-row">
            <div className="reference-hero home-reference-hero">
              <div className="reference-hero-copy">
                <div className="home-hero-kicker"><span aria-hidden /> Made for the group chat</div>
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
                <ul className="home-trust" aria-label="Safety features">
                  <li><Icon name="shield" className="h-3.5 w-3.5" /> Invite-only rooms</li>
                  <li><Icon name="ban" className="h-3.5 w-3.5" /> Host moderation</li>
                  <li><Icon name="scale" className="h-3.5 w-3.5" /> Age-aware prompts</li>
                </ul>
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

      <div className="home-lower">
        <DailyChallenge
          games={DAILY_GAMES}
          starting={dailyStarting}
          disabled={isGuest}
          onPlay={(gameId) => void startDaily(gameId)}
        />
        {dailyError ? (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {dailyError}
          </p>
        ) : null}
        <section className="home-sheet" aria-labelledby="home-games-title">
          <div className="home-sheet-inner">
            <div className="home-section-head">
              <div>
                <p className="home-section-kicker"><span aria-hidden>01</span> The lineup</p>
                <h2 id="home-games-title">Pick a game, any game</h2>
              </div>
              <div className="home-section-aside">
                <p className="home-section-note">Eight favorites from a full library of social, writing, trivia and real-time games.</p>
                <Badge tone="primary">Free to play</Badge>
              </div>
            </div>
            <div className="home-games-grid">
              {FEATURED.map((id, index) => {
                const meta = gameMeta(id);
                return (
                  <div key={id} className={`color-card home-game-card ${["purple", "lime", "pink", "cyan"][index % 4]}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="library-mark" aria-hidden><Icon name={meta.icon} /></span>
                      <span className="home-game-index" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h3>{meta.name}</h3>
                    <p>{meta.description}</p>
                    <span className="home-game-tag">{meta.category}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-sheet home-how" aria-labelledby="home-how-title">
          <div className="home-sheet-inner">
            <div className="home-section-head">
              <div>
                <p className="home-section-kicker"><span aria-hidden>02</span> How it works</p>
                <h2 id="home-how-title">Three steps to better stories.</h2>
              </div>
              <p className="home-section-note">One phone each. One screen for the room. No downloads.</p>
            </div>
            <div className="home-steps">
              {STEPS.map((step, index) => (
                <div key={step.title} className="home-step-card">
                  <span className="home-step-index" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="home-sheet home-safety" aria-labelledby="home-safety-title">
          <div className="home-sheet-inner home-safety-layout">
            <div className="home-safety-intro">
              <p className="home-section-kicker"><span aria-hidden>03</span> Safe by design</p>
              <h2 id="home-safety-title">Good chaos.<br />Guardrails included.</h2>
              <p>GroupLore is built for people you already know. The fun is loud; the room, content and data boundaries are not.</p>
            </div>
            <div className="home-safety-grid">
              {SAFETY.map((item) => (
                <div key={item.title} className="home-safety-card">
                  <span className="security-icon" aria-hidden><Icon name={item.icon} className="h-5 w-5" /></span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
