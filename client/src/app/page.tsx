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
import { api } from "@/lib/api";
import { gameMeta } from "@/lib/gameMeta";
import { ensureLobby, lobbyPath } from "@/lib/play";
import { motion, useReducedMotion } from "framer-motion";
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

export default function LandingPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
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

  return (
    <main className="min-h-screen">
      <AppHeader />
      <section className="hero-tint">
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-20">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="max-w-3xl"
          >
            <p className="eyebrow">Game night, sorted</p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-[-0.05em] sm:text-6xl">
              The games your group will still be talking about next week.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Fast, social party games built around the people you already know.
              Pick a room, share the code, and play from your phone.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => {
                  if (!isSignedIn) {
                    router.push("/sign-up");
                    return;
                  }
                  setMode(mode === "create" ? "home" : "create");
                }}
              >
                Create a group
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setMode(mode === "join" ? "home" : "join")}
              >
                Join with a code
              </Button>
              {!isSignedIn ? (
                <Button size="lg" variant="ghost" onClick={() => router.push("/guest")}>
                  Continue as guest
                </Button>
              ) : (
                <Button size="lg" variant="ghost" onClick={() => router.push("/dashboard")}>
                  My hub
                </Button>
              )}
            </div>

            {mode !== "home" ? (
              <Card className="mt-6 max-w-lg p-5">
                {mode === "create" ? (
                  <>
                    <h2 className="font-display text-xl font-semibold">Name your group</h2>
                    <p className="mt-1 text-sm text-muted">You can invite everyone after the room opens.</p>
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
                    <Button className="mt-4 w-full" loading={loading} onClick={() => void handleCreate()}>
                      Create and open lobby
                    </Button>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-xl font-semibold">Join a room</h2>
                    <p className="mt-1 text-sm text-muted">Enter the code your host shared with you.</p>
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
                    <Button className="mt-4 w-full" disabled={joinCode.length !== 6} loading={loading} onClick={() => void handleJoin()}>
                      Join room
                    </Button>
                  </>
                )}
                {error ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
              </Card>
            ) : null}
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-4 py-14 sm:px-6">
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
              <Card key={id} className="group p-4">
                <span
                  className="flex h-12 w-12 -rotate-3 items-center justify-center rounded-[14px] text-2xl transition-transform group-hover:rotate-0"
                  style={{ background: `color-mix(in srgb, ${meta.color} 16%, var(--surface))` }}
                  aria-hidden
                >
                  {meta.emoji}
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{meta.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{meta.description}</p>
                <p className="mt-3 text-xs font-medium text-muted">{meta.category}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-14 sm:px-6">
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
