"use client";

import AcronymWarsGame, {
  type AcronymView,
} from "@/components/game/AcronymWarsGame";
import AvoidTheAnswerGame, {
  type AvoidView,
} from "@/components/game/AvoidTheAnswerGame";
import BluffGame, { type BluffView } from "@/components/game/BluffGame";
import CaptionThisGame, {
  type CaptionThisView,
} from "@/components/game/CaptionThisGame";
import CategoryRushGame, {
  type CategoryRushView,
} from "@/components/game/CategoryRushGame";
import FiveSecondGame, {
  type FiveSecondView,
} from "@/components/game/FiveSecondGame";
import GameShell from "@/components/game/GameShell";
import { useAuth } from "@/components/AuthProvider";
import HigherLowerGame, {
  type HigherLowerView,
} from "@/components/game/HigherLowerGame";
import HiveMindGame, {
  type HiveMindView,
} from "@/components/game/HiveMindGame";
import HotTakesGame, {
  type HotTakesView,
} from "@/components/game/HotTakesGame";
import ImpostorGame, {
  type ImpostorView,
} from "@/components/game/ImpostorGame";
import Leaderboard from "@/components/game/Leaderboard";
import LiarsBarGame, {
  type LiarsView,
} from "@/components/game/LiarsBarGame";
import MostLikelyToGame, {
  type MltView,
} from "@/components/game/MostLikelyToGame";
import OddOneOutGame, {
  type OddOneOutView,
} from "@/components/game/OddOneOutGame";
import OverratedGame, {
  type OverratedView,
} from "@/components/game/OverratedGame";
import PitchPerfectGame, {
  type PitchView,
} from "@/components/game/PitchPerfectGame";
import RoastBattleGame, {
  type RoastView,
} from "@/components/game/RoastBattleGame";
import WavelengthGame, {
  type WavelengthView,
} from "@/components/game/WavelengthGame";
import WouldYouRatherGame, {
  type WouldYouRatherView,
} from "@/components/game/WouldYouRatherGame";
import { useRoom } from "@/hooks/useRoom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { isSignedIn } = useAuth();
  const { room, status, error, kicked, act, send, leave, clearError } =
    useRoom(sessionId);

  const groupId = room?.groupId || "";
  const exitPath = isSignedIn
    ? groupId
      ? `/group/${groupId}`
      : "/dashboard"
    : "/";
  const backLabel = isSignedIn
    ? groupId
      ? "Back to group"
      : "Back to dashboard"
    : "Back to home";
  const gameMeta = room?.catalog.find((game) => game.id === room.gameId);
  const gameView = (room?.game || null) as {
    round?: number;
    rounds?: number;
  } | null;

  useEffect(() => {
    if (room?.phase === "lobby") {
      router.replace(`/lobby/${sessionId}${groupId ? `?groupId=${groupId}` : ""}`);
    }
  }, [room?.phase, router, sessionId, groupId]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  const exit = () => {
    if (
      room?.phase === "playing" &&
      !window.confirm("Leave the game? Your seat will be given up.")
    ) {
      return;
    }
    leave();
    router.push(exitPath);
  };

  if (kicked) {
    return (
      <GameShell title="Removed from game" accent="grape">
        <div className="party-card p-6 text-center">
          <p className="text-4xl">👋</p>
          <p className="mt-3 font-display text-xl font-semibold text-ink">
            {error?.message || "You were removed from this room."}
          </p>
          <button
            onClick={() => router.push(exitPath)}
            className="mt-5 min-h-11 rounded-full bg-grape px-6 font-display text-sm font-semibold text-white"
          >
            {backLabel}
          </button>
        </div>
      </GameShell>
    );
  }

  if (!room) {
    return (
      <GameShell title="Game" accent="grape" status={status}>
        <div className="party-card p-8 text-center">
          {status === "error" ? (
            <>
              <p className="text-3xl">📡</p>
              <p className="mt-3 font-display text-lg font-semibold text-ink">
                {error?.message || "Could not join the game"}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 min-h-11 rounded-full bg-grape px-6 font-display text-sm font-semibold text-white"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-lavender border-t-grape" />
              <p className="mt-4 font-display text-lg font-semibold text-ink">
                Joining the game…
              </p>
            </>
          )}
        </div>
      </GameShell>
    );
  }

  const activeView = room.phase === "playing" ? gameView : null;
  const results = room.phase === "results";

  return (
    <GameShell
      title={gameMeta?.name || "Game"}
      emoji={gameMeta?.emoji}
      accent={gameMeta?.accent || "grape"}
      round={gameView?.round}
      totalRounds={gameView?.rounds}
      endsAt={room.endsAt}
      serverNow={room.serverNow}
      status={status}
      onExit={exit}
      exitLabel="Quit"
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-2xl border border-coral/30 bg-coral/10 px-4 py-2 text-center text-sm font-bold text-[#B83232]"
          >
            {error.message}
          </motion.div>
        )}
      </AnimatePresence>

      {activeView && room.gameId === "most-likely-to" && (
        <MostLikelyToGame
          room={room}
          view={room.game as unknown as MltView}
          send={send}
        />
      )}

      {activeView && room.gameId === "guess-impostor" && (
        <ImpostorGame
          room={room}
          view={room.game as unknown as ImpostorView}
          send={send}
        />
      )}

      {activeView && room.gameId === "five-second" && (
        <FiveSecondGame
          room={room}
          view={room.game as unknown as FiveSecondView}
          send={send}
        />
      )}

      {activeView && room.gameId === "overrated-underrated" && (
        <OverratedGame
          room={room}
          view={room.game as unknown as OverratedView}
          send={send}
        />
      )}

      {activeView && room.gameId === "hive-mind" && (
        <HiveMindGame
          room={room}
          view={room.game as unknown as HiveMindView}
          send={send}
        />
      )}

      {activeView && room.gameId === "odd-one-out" && (
        <OddOneOutGame
          room={room}
          view={room.game as unknown as OddOneOutView}
          send={send}
        />
      )}

      {activeView && room.gameId === "bluff" && (
        <BluffGame
          room={room}
          view={room.game as unknown as BluffView}
          send={send}
        />
      )}

      {activeView && room.gameId === "hot-takes" && (
        <HotTakesGame
          room={room}
          view={room.game as unknown as HotTakesView}
          send={send}
        />
      )}

      {activeView && room.gameId === "liars-bar" && (
        <LiarsBarGame
          room={room}
          view={room.game as unknown as LiarsView}
          send={send}
        />
      )}

      {activeView && room.gameId === "higher-or-lower" && (
        <HigherLowerGame
          room={room}
          view={room.game as unknown as HigherLowerView}
          send={send}
        />
      )}

      {activeView && room.gameId === "avoid-the-answer" && (
        <AvoidTheAnswerGame
          room={room}
          view={room.game as unknown as AvoidView}
          send={send}
        />
      )}

      {activeView && room.gameId === "would-you-rather" && (
        <WouldYouRatherGame
          room={room}
          view={room.game as unknown as WouldYouRatherView}
          send={send}
        />
      )}

      {activeView && room.gameId === "caption-this" && (
        <CaptionThisGame
          room={room}
          view={room.game as unknown as CaptionThisView}
          send={send}
        />
      )}

      {activeView && room.gameId === "wavelength" && (
        <WavelengthGame
          room={room}
          view={room.game as unknown as WavelengthView}
          send={send}
        />
      )}

      {activeView && room.gameId === "category-rush" && (
        <CategoryRushGame
          room={room}
          view={room.game as unknown as CategoryRushView}
          send={send}
        />
      )}

      {activeView && room.gameId === "roast-battle" && (
        <RoastBattleGame
          room={room}
          view={room.game as unknown as RoastView}
          send={send}
        />
      )}

      {activeView && room.gameId === "acronym-wars" && (
        <AcronymWarsGame
          room={room}
          view={room.game as unknown as AcronymView}
          send={send}
        />
      )}

      {activeView && room.gameId === "pitch-perfect" && (
        <PitchPerfectGame
          room={room}
          view={room.game as unknown as PitchView}
          send={send}
        />
      )}

      {activeView &&
        ![
          "most-likely-to",
          "guess-impostor",
          "five-second",
          "overrated-underrated",
          "hive-mind",
          "odd-one-out",
          "bluff",
          "hot-takes",
          "liars-bar",
          "higher-or-lower",
          "avoid-the-answer",
          "would-you-rather",
          "caption-this",
          "wavelength",
          "category-rush",
          "roast-battle",
          "acronym-wars",
          "pitch-perfect",
        ].includes(room.gameId || "") && (
          <div className="party-card p-8 text-center">
            <p className="text-3xl">🚧</p>
            <p className="mt-3 font-display text-lg font-semibold text-ink">
              This game is not available yet.
            </p>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              Ask the host to end the game and pick another one.
            </p>
            {room.you?.isHost && (
              <button
                onClick={() => act("end")}
                className="mt-4 min-h-11 rounded-full bg-grape px-6 font-display text-sm font-semibold text-white"
              >
                End game
              </button>
            )}
          </div>
        )}

      {results && room.result && (
        <div className="space-y-4">
          <div className="party-card bg-honey/30 p-6 text-center">
            <p className="text-4xl">🏆</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
              Final scores
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-ink">
              {room.result.ranking
                .filter((entry) => entry.isWinner)
                .map((entry) => entry.name)
                .join(" & ") || "Nobody scored"}
            </p>
          </div>

          <Leaderboard entries={room.result.ranking} youId={room.you?.id} />

          {room.you?.isHost ? (
            <button
              onClick={() => act("restart")}
              className="min-h-14 w-full rounded-2xl bg-grape px-6 font-display text-base font-semibold text-white shadow-pop transition hover:bg-[#7C4DEB]"
            >
              Back to lobby →
            </button>
          ) : (
            <p className="text-center text-sm font-semibold text-ink-soft">
              Waiting for the host to start another game…
            </p>
          )}

          <button
            onClick={() => {
              leave();
              router.push(exitPath);
            }}
            className="mx-auto block min-h-11 rounded-full px-4 text-xs font-bold uppercase tracking-wide text-ink-soft underline-offset-4 hover:underline"
          >
            {backLabel}
          </button>
        </div>
      )}
    </GameShell>
  );
}
