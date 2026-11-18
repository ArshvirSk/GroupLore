"use client";

import { Icon, type IconName } from "@/components/ui/Icon";

export type DailyChallengeGame = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
};

export default function DailyChallenge({
  games,
  starting,
  disabled,
  onPlay,
  className = "",
}: {
  games: DailyChallengeGame[];
  starting: string | null;
  disabled?: boolean;
  onPlay: (gameId: string) => void;
  className?: string;
}) {
  if (!games.length) return null;

  return (
    <section className={`daily-challenge ${className}`} aria-label="Daily Challenge">
      <div className="daily-challenge-copy">
        <p className="daily-challenge-kicker">
          <span aria-hidden>✦</span> Daily Challenge
        </p>
        <h2>Same puzzle. Every group. Today only.</h2>
        <p>Both games use the UTC date. The board resets at midnight UTC.</p>
      </div>
      <div className="daily-challenge-games">
        {games.map((game) => (
          <button
            key={game.id}
            type="button"
            className="daily-challenge-game"
            disabled={disabled || Boolean(starting)}
            onClick={() => onPlay(game.id)}
          >
            <span className="daily-challenge-icon" aria-hidden>
              <Icon name={game.icon} className="h-5 w-5" />
            </span>
            <span className="daily-challenge-name">
              <b>{game.name}</b>
              <small>{game.description}</small>
            </span>
            {starting === game.id ? (
              <span
                aria-label={`Starting ${game.name}`}
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              <Icon name="arrow-right" className="h-4 w-4" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
