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
import BlackjackShowdownGame, {
  type BlackjackView,
} from "@/components/game/BlackjackShowdownGame";
import CheatGame, { type CheatView } from "@/components/game/CheatGame";
import SkullDuelGame, {
  type SkullView,
} from "@/components/game/SkullDuelGame";
import CategoryRushGame, {
  type CategoryRushView,
} from "@/components/game/CategoryRushGame";
import TwoTruthsGame, {
  type TwoTruthsView,
} from "@/components/game/TwoTruthsGame";
import FactOrFictionGame, {
  type FactView,
} from "@/components/game/FactOrFictionGame";
import FiveSecondGame, {
  type FiveSecondView,
} from "@/components/game/FiveSecondGame";
import GameShell from "@/components/game/GameShell";
import { Icon } from "@/components/ui/Icon";
import GuestUpgradePrompt from "@/components/GuestUpgradePrompt";
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
import ReportPlayer from "@/components/game/ReportPlayer";
import LiarsBarGame, {
  type LiarsView,
} from "@/components/game/LiarsBarGame";
import MadLibsGame, {
  type MadLibsView,
} from "@/components/game/MadLibsGame";
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
import RoundTwoGame from "@/components/game/RoundTwoGame";
import TeamAssignment from "@/components/game/TeamAssignment";
import WavelengthGame, {
  type WavelengthView,
} from "@/components/game/WavelengthGame";
import WouldYouRatherGame, {
  type WouldYouRatherView,
} from "@/components/game/WouldYouRatherGame";
import { useRoom } from "@/hooks/useRoom";
import { useWakeLock } from "@/hooks/useWakeLock";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { isSignedIn, isGuest } = useAuth();
  const autoStartRef = useRef(false);
  const { room, status, error, kicked, act, send, leave, clearError } =
    useRoom(sessionId);
  useWakeLock(Boolean(room && room.phase === "playing" && !kicked));

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

  // The lobby API has already authorized the start. Once every seated player
  // has a socket, the host starts the engine room automatically.
  useEffect(() => {
    if (autoStartRef.current || !room || room.phase !== "lobby") return;
    if (!room.you?.isHost || !room.gameId) return;
    const game = room.catalog.find((entry) => entry.id === room.gameId);
    if (!game || room.players.length !== room.players.filter((p) => p.connected).length) {
      return;
    }
    if (game.teams) return;
    if (room.players.length < game.minPlayers || room.players.length > game.maxPlayers) {
      return;
    }
    autoStartRef.current = true;
    act("start");
  }, [room, act]);

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
          <Icon name="hand" className="mx-auto h-10 w-10" />
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
              <Icon name="signal" className="mx-auto h-8 w-8" />
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
  const teamGame = room.catalog.find((entry) => entry.id === room.gameId)?.teams;

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

      {room.you?.muted ? (
        <div
          role="status"
          className="mb-4 flex items-start justify-center gap-2 rounded-2xl border border-honey/50 bg-honey/20 px-4 py-2 text-center text-sm font-bold text-ink"
        >
          <Icon name="hand" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You&apos;re muted by the host. Your game actions won&apos;t count until
            they unmute you.
          </span>
        </div>
      ) : null}

      {room.phase !== "results" ? (
        <ReportPlayer room={room} act={act} />
      ) : null}

      {room.you?.isHost && room.phase !== "results" && room.players.length > 1 ? (
        <div className="mb-4 rounded-2xl border border-border bg-surface px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              Host controls
            </span>
            {room.players
              .filter((player) => !player.isHost)
              .map((player) => (
                <span key={player.id} className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      act("mute", { playerId: player.id, muted: !player.muted })
                    }
                    aria-pressed={player.muted}
                    title={
                      player.muted
                        ? `${player.name} cannot submit game events`
                        : `Mute ${player.name}`
                    }
                    className={`min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors ${
                      player.muted
                        ? "border-danger/40 bg-danger/10 text-danger"
                        : "border-border text-muted hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    {player.muted ? "Unmute" : "Mute"} {player.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Block ${player.name} from this room?`)) {
                        act("block", { playerId: player.id });
                      }
                    }}
                    title={`Remove and block ${player.name} from rejoining`}
                    className="min-h-11 rounded-full border border-danger/40 bg-danger/10 px-3 text-xs font-semibold text-danger"
                  >
                    Block
                  </button>
                </span>
              ))}
          </div>
        </div>
      ) : null}

      {room.phase === "lobby" && teamGame ? (
        <TeamAssignment room={room} act={act} />
      ) : null}

      {activeView &&
        [
          "fill-the-blank",
          "connections",
          "survey-says",
          "scattergories",
          "pattern-memory",
          "reaction-duel",
          "story-chain",
          "password",
          "boggle-rush",
          "buzzer-trivia",
          "liars-dice",
          "blur-guess",
          "codenames",
          "blind-sketch",
          "duel-bracket",
        ].includes(room.gameId || "") && (
          <RoundTwoGame
            room={room}
            view={room.game as unknown as Record<string, unknown>}
            send={send}
          />
        )}

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

      {activeView && room.gameId === "cheat" && (
        <CheatGame
          room={room}
          view={room.game as unknown as CheatView}
          send={send}
        />
      )}

      {activeView && room.gameId === "skull-duel" && (
        <SkullDuelGame
          room={room}
          view={room.game as unknown as SkullView}
          send={send}
        />
      )}

      {activeView && room.gameId === "blackjack-showdown" && (
        <BlackjackShowdownGame
          room={room}
          view={room.game as unknown as BlackjackView}
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

      {activeView && room.gameId === "mad-libs" && (
        <MadLibsGame
          room={room}
          view={room.game as unknown as MadLibsView}
          send={send}
        />
      )}

      {activeView && room.gameId === "two-truths" && (
        <TwoTruthsGame
          room={room}
          view={room.game as unknown as TwoTruthsView}
          send={send}
        />
      )}

      {activeView && room.gameId === "fact-or-fiction" && (
        <FactOrFictionGame
          room={room}
          view={room.game as unknown as FactView}
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
          "cheat",
          "skull-duel",
          "blackjack-showdown",
          "higher-or-lower",
          "avoid-the-answer",
          "would-you-rather",
          "caption-this",
          "wavelength",
          "category-rush",
          "roast-battle",
          "acronym-wars",
          "pitch-perfect",
          "mad-libs",
          "two-truths",
          "fact-or-fiction",
          "fill-the-blank",
          "connections",
          "survey-says",
          "scattergories",
          "pattern-memory",
          "reaction-duel",
          "story-chain",
          "password",
          "boggle-rush",
          "buzzer-trivia",
          "liars-dice",
          "blur-guess",
          "codenames",
          "blind-sketch",
          "duel-bracket",
        ].includes(room.gameId || "") && (
          <div className="party-card p-8 text-center">
            <Icon name="settings" className="mx-auto h-8 w-8" />
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
            <Icon name="trophy" className="mx-auto h-10 w-10" />
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

          {room.result.shareId ? (
            <Link
              href={`/recap/${room.result.shareId}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 text-sm font-bold text-primary"
            >
              <Icon name="link" className="h-4 w-4" /> Open shareable recap
            </Link>
          ) : null}

          {isGuest && <GuestUpgradePrompt />}

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
