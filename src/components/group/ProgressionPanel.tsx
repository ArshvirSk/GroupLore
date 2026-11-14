"use client";

import { Icon } from "@/components/ui/Icon";
import { Badge, Card, EmptyState } from "@/components/ui";
import { api } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

interface Rating {
  user_id: string;
  game_type: string;
  rating: number;
  games_played: number;
  wins: number;
}

interface Rivalry {
  user_a: string;
  user_b: string;
  games: number;
  a_wins: number;
  b_wins: number;
  draws: number;
}

interface Achievement {
  id: string;
  user_id: string;
  key: string;
  label: string;
}

interface Member {
  userId: string;
  name: string;
}

function gameName(type: string) {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ProgressionPanel({ groupId }: { groupId: string }) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getProgression(groupId)
      .then((data) => {
        setRatings(data.ratings || []);
        setRivalries(data.rivalries || []);
        setAchievements(data.achievements || []);
        setMembers(data.members || []);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load progression"),
      );
  }, [groupId]);

  const names = useMemo(
    () => new Map(members.map((member) => [member.userId, member.name])),
    [members],
  );
  const topRatings = useMemo(
    () => [...ratings].sort((a, b) => b.rating - a.rating).slice(0, 6),
    [ratings],
  );

  return (
    <section className="mt-8" aria-labelledby="progression-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-primary">Every game counts</p>
          <h2 id="progression-title" className="font-display text-2xl font-semibold">
            Progression & rivalries
          </h2>
        </div>
        <Badge tone="accent">{ratings.length} game records</Badge>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {topRatings.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon="chart"
            title="No ratings yet"
            description="Finish a group game to start Elo ratings, head-to-head records and achievements."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold">
              <Icon name="trophy" className="h-5 w-5" /> Rating leaders
            </h3>
            <div className="mt-3 space-y-2">
              {topRatings.map((rating) => (
                <div
                  key={`${rating.user_id}:${rating.game_type}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft font-mono text-sm font-bold text-primary">
                    {rating.rating}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {names.get(rating.user_id) || "Player"}
                    </p>
                    <p className="text-xs text-muted">
                      {gameName(rating.game_type)} · {rating.wins}W / {rating.games_played}G
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold">
              <Icon name="zap" className="h-5 w-5" /> Rivalry board
            </h3>
            {rivalries.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Play together to build head-to-head records.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {rivalries.slice(0, 5).map((rivalry) => (
                  <div
                    key={`${rivalry.user_a}:${rivalry.user_b}`}
                    className="rounded-xl border border-border bg-surface-2/50 px-3 py-2"
                  >
                    <p className="text-sm font-bold">
                      {names.get(rivalry.user_a) || "Player"} vs {names.get(rivalry.user_b) || "Player"}
                    </p>
                    <p className="text-xs text-muted">
                      {rivalry.games} games · {rivalry.a_wins}–{rivalry.b_wins}
                      {rivalry.draws ? ` · ${rivalry.draws} draws` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 lg:col-span-2">
            <h3 className="flex items-center gap-2 font-display text-xl font-bold">
              <Icon name="star" className="h-5 w-5" /> Hall of fame
            </h3>
            {achievements.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Milestones will appear here as the group plays.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {achievements.slice(0, 12).map((achievement) => (
                  <Badge key={achievement.id} tone="accent">
                    {names.get(achievement.user_id) || "Player"} · {achievement.label}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
