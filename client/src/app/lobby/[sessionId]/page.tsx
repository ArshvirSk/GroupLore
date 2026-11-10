"use client";

import AvatarBubble from "@/components/AvatarBubble";
import FloatingBlobs from "@/components/FloatingBlobs";
import GameCard from "@/components/GameCard";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { Player, useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface GameMode {
  id: string;
  label: string;
  description: string;
}

const GAMES: {
  id: string;
  title: string;
  description: string;
  emoji: string;
  modes: GameMode[];
}[] = [
  {
    id: "overrated-underrated",
    title: "Overrated / Underrated",
    description: "Vote if something is overrated or underrated.",
    emoji: "📊",
    modes: [
      { id: "classic", label: "Classic", description: "Standard prompts" },
      {
        id: "spicy",
        label: "Spicy 🌶️",
        description: "Controversial takes only",
      },
      {
        id: "about-us",
        label: "About Us",
        description: "Prompts about your group",
      },
      { id: "speed", label: "Speed ⚡", description: "5-second voting timer" },
    ],
  },
  {
    id: "guess-impostor",
    title: "Guess the Impostor",
    description: "One person doesn't know the answer. Find them.",
    emoji: "🔍",
    modes: [
      { id: "classic", label: "Classic", description: "1 impostor" },
      { id: "double-agent", label: "Double Agent", description: "2 impostors" },
      { id: "blind", label: "Blind", description: "Vote without discussion" },
    ],
  },
  {
    id: "five-second",
    title: "5 Second Challenge",
    description: "Answer before time runs out.",
    emoji: "⏱",
    modes: [
      { id: "classic", label: "Classic", description: "5 seconds" },
      { id: "lightning", label: "Lightning ⚡", description: "3 seconds" },
      {
        id: "marathon",
        label: "Marathon",
        description: "10 seconds, 5 answers",
      },
      {
        id: "hot-seat",
        label: "Hot Seat 🔥",
        description: "3 rounds in a row",
      },
    ],
  },
  {
    id: "best-friend-test",
    title: "Best Friend Test",
    description: "How well do you really know your friends?",
    emoji: "🧠",
    modes: [
      { id: "classic", label: "Classic", description: "4 options" },
      { id: "hard", label: "Hard Mode 💀", description: "6 options" },
      { id: "timed", label: "Timed ⏰", description: "10-second timer" },
      {
        id: "who-said-it",
        label: "Who Said It?",
        description: "Match quotes to people",
      },
    ],
  },
  {
    id: "most-likely-to",
    title: "Most Likely To",
    description: "Vote who in the group fits the prompt best.",
    emoji: "👑",
    modes: [
      { id: "classic", label: "Classic", description: "Standard voting" },
      { id: "anonymous", label: "Anonymous 🕵️", description: "Hidden votes" },
      { id: "ranked", label: "Ranked", description: "Rank all members" },
    ],
  },
  {
    id: "liars-bar",
    title: "Liars Bar",
    description: "One player bluffs. Can you spot the lie?",
    emoji: "🎭",
    modes: [
      { id: "classic", label: "Classic", description: "Truth vs lie" },
      {
        id: "two-truths",
        label: "2 Truths 1 Lie",
        description: "3 statements, find the lie",
      },
      {
        id: "poker-face",
        label: "Poker Face 🃏",
        description: "Confidence bets",
      },
    ],
  },
  {
    id: "higher-or-lower",
    title: "Higher or Lower",
    description: "Guess who scored higher on each trait.",
    emoji: "📈",
    modes: [
      { id: "classic", label: "Classic", description: "Standard chain" },
      { id: "streak", label: "Streak 🔥", description: "3-in-a-row or bust" },
      { id: "blind", label: "Blind", description: "No score reveals" },
    ],
  },
  {
    id: "avoid-the-answer",
    title: "Avoid the Answer",
    description: "Describe a friend without using banned words.",
    emoji: "🚫",
    modes: [
      { id: "classic", label: "Classic", description: "Standard taboo" },
      { id: "charades", label: "Charades 🎭", description: "Emoji clues only" },
      { id: "rapid", label: "Rapid Fire ⚡", description: "30-second timer" },
    ],
  },
];

export default function LobbyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId") || "";
  const router = useRouter();
  const { user } = useUser();
  const { dbUserId } = useUserStore();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Player";

  const {
    players,
    hostId,
    gameType,
    setPlayers,
    setHostId,
    setGameType,
    setSessionId,
  } = useGameStore();
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [gameMode, setGameMode] = useState("classic");

  const isHost = mySocketId === hostId;

  useEffect(() => {
    if (!dbUserId || !displayName) {
      router.push("/");
      return;
    }
    setSessionId(sessionId);
    const socket = connectSocket();

    socket.on("connect", () => {
      setMySocketId(socket.id || null);
      socket.emit("join-lobby", { sessionId, userId: dbUserId, displayName });
    });

    socket.on(
      "lobby-update",
      ({
        players: p,
        hostId: h,
        gameType: g,
        gameMode: m,
      }: {
        players: Player[];
        hostId: string;
        gameType: string;
        gameMode?: string;
      }) => {
        setPlayers(p);
        setHostId(h);
        if (g) setGameType(g);
        if (m) setGameMode(m);
      },
    );

    socket.on(
      "game-selected",
      ({
        gameType: g,
        gameMode: m,
      }: {
        gameType: string;
        gameMode?: string;
      }) => {
        setGameType(g);
        if (m) setGameMode(m);
      },
    );

    socket.on(
      "game-starting",
      ({
        gameType: g,
        sessionId: s,
        gameMode: m,
      }: {
        gameType: string;
        sessionId: string;
        gameMode?: string;
      }) => {
        router.push(
          `/game/${s}?groupId=${groupId}&gameType=${g}&gameMode=${m || "classic"}`,
        );
      },
    );

    socket.on("kicked", () => {
      disconnectSocket();
      router.push("/");
    });
    socket.on("error-message", ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(""), 3000);
    });

    const handleBeforeUnload = () => {
      socket.emit("leave-lobby");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      socket.emit("leave-lobby");
      socket.off("connect");
      socket.off("lobby-update");
      socket.off("game-selected");
      socket.off("game-starting");
      socket.off("kicked");
      socket.off("error-message");
    };
  }, [sessionId, dbUserId, displayName]);

  const selectedGame = GAMES.find((g) => g.id === gameType);
  const selectedModeInfo = selectedGame?.modes.find((m) => m.id === gameMode);

  return (
    <main className="min-h-screen px-4 py-12 relative">
      <FloatingBlobs />
      <div className="max-w-xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-card border border-border text-xs text-text-secondary mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Lobby
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">
            Waiting
            <span className="font-accent normal-case text-text-secondary italic">
              {" "}
              for players
            </span>
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {players.length} player{players.length !== 1 ? "s" : ""} connected
          </p>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-center text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.div>
        )}

        {/* Players */}
        <motion.div
          className="glass-card p-6 mb-6"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-wrap justify-center gap-5">
            {players.map((player, i) => (
              <motion.div
                key={player.socketId}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08, type: "spring" }}
                className="relative"
              >
                <AvatarBubble
                  name={player.displayName}
                  avatarUrl={player.avatarUrl}
                  isHost={player.isHost}
                  isReady={player.isReady}
                  size="lg"
                />
                {isHost && player.socketId !== mySocketId && (
                  <button
                    onClick={() =>
                      getSocket().emit("kick-player", {
                        targetSocketId: player.socketId,
                      })
                    }
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger/80 text-white text-[9px] flex items-center justify-center hover:bg-danger transition-colors"
                  >
                    ✕
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Game Selection (Host only) */}
        {isHost && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
              Select Game
            </h2>
            <div className="grid gap-2">
              {GAMES.map((game) => (
                <div key={game.id}>
                  <GameCard
                    title={game.title}
                    description={game.description}
                    emoji={game.emoji}
                    selected={gameType === game.id}
                    onClick={() => {
                      setGameMode("classic");
                      getSocket().emit("select-game", {
                        gameType: game.id,
                        gameMode: "classic",
                      });
                    }}
                  />
                  {/* Mode pills — expand when game is selected */}
                  <AnimatePresence>
                    {gameType === game.id && game.modes.length > 1 && (
                      <motion.div
                        className="flex flex-wrap gap-1.5 pl-4 mt-1.5 mb-2"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {game.modes.map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => {
                              setGameMode(mode.id);
                              getSocket().emit("select-game", {
                                gameType: game.id,
                                gameMode: mode.id,
                              });
                            }}
                            className={`px-3 py-1 rounded-full text-[11px] border transition-all ${
                              gameMode === mode.id
                                ? "bg-accent/20 border-accent/40 text-accent font-semibold"
                                : "bg-bg-card border-border text-text-muted hover:border-border-hover"
                            }`}
                            title={mode.description}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Selected (non-host sees this) */}
        {!isHost && gameType && (
          <motion.div
            className="glass-card p-5 mb-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-text-muted text-xs uppercase tracking-wider">
              Host selected
            </p>
            <p className="text-lg font-bold mt-1 tracking-tight">
              {selectedGame?.emoji} {selectedGame?.title}
            </p>
            {selectedModeInfo && selectedModeInfo.id !== "classic" && (
              <p className="text-accent text-xs mt-1 font-medium">
                Mode: {selectedModeInfo.label}
              </p>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {isHost ? (
            <button
              onClick={() => getSocket().emit("start-game")}
              className="neon-btn neon-btn-purple w-full py-4"
              disabled={!gameType}
            >
              {gameType ? "Start Game →" : "Select a game first"}
            </button>
          ) : (
            <button
              onClick={() => {
                const me = players.find((p) => p.socketId === mySocketId);
                getSocket().emit("player-ready", { isReady: !me?.isReady });
              }}
              className={`neon-btn w-full py-4 ${players.find((p) => p.socketId === mySocketId)?.isReady ? "neon-btn-outline" : "neon-btn-purple"}`}
            >
              {players.find((p) => p.socketId === mySocketId)?.isReady
                ? "✓ Ready"
                : "Ready Up"}
            </button>
          )}
        </motion.div>
      </div>
    </main>
  );
}
