"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

type DailyGame = {
  id: string;
  name: string;
  description: string;
  completed: boolean;
};

type DailyProgress = {
  today: string;
  streak: {
    current: number;
    best: number;
    completedToday: boolean;
    lastCompleted: string | null;
  };
  games: DailyGame[];
};

const ICONS: Record<string, IconName> = {
  "blur-guess": "image",
  connections: "brain",
};

function dayLabel(count: number) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

export default function GroupDailyChallenge({
  groupId,
  starting,
  onPlay,
  className = "",
}: {
  groupId: string;
  starting: string | null;
  onPlay: (gameId: string) => void;
  className?: string;
}) {
  const [progress, setProgress] = useState<DailyProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getGroupDaily(groupId)
      .then((data: DailyProgress) => {
        if (active) setProgress(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not load daily progress",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [groupId]);

  return (
    <section
      className={`daily-challenge group-daily ${className}`}
      aria-label="Group Daily Challenge"
    >
      <div className="daily-challenge-copy">
        <p className="daily-challenge-kicker">
          <span aria-hidden>✦</span> Group daily challenge
        </p>
        <h2>Keep the group&apos;s streak alive.</h2>
        <p>
          Same UTC puzzle for every group. Finish either daily to mark today
          complete. Replays are always welcome.
        </p>
        {progress ? (
          <div className="group-daily-stats">
            <div className="group-daily-stat">
              <span>Current streak</span>
              <b>{dayLabel(progress.streak.current)}</b>
            </div>
            <div className="group-daily-stat">
              <span>Best</span>
              <b>{dayLabel(progress.streak.best)}</b>
            </div>
          </div>
        ) : null}
      </div>

      <div className="daily-challenge-games">
        {error ? (
          <p role="alert" className="group-daily-error">
            {error}
          </p>
        ) : null}
        {!progress && !error ? (
          <p className="group-daily-loading">Loading today&apos;s challenge…</p>
        ) : null}
        {progress?.games.map((game) => (
          <button
            key={game.id}
            type="button"
            className="daily-challenge-game"
            disabled={Boolean(starting)}
            aria-label={`${game.completed ? "Replay" : "Play"} ${game.name} daily`}
            onClick={() => onPlay(game.id)}
          >
            <span className="daily-challenge-icon" aria-hidden>
              <Icon name={ICONS[game.id] || "gamepad"} className="h-5 w-5" />
            </span>
            <span className="daily-challenge-name">
              <b>{game.name}</b>
              <small>
                {game.completed ? "Completed today · replay open" : game.description}
              </small>
            </span>
            {starting === game.id ? (
              <span
                aria-label={`Starting ${game.name}`}
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              <span
                className={`group-daily-status ${game.completed ? "is-done" : ""}`}
              >
                {game.completed ? "Replay" : "Play"}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
