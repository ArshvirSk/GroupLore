"use client";

import { Icon } from "@/components/ui/Icon";
import { Badge, Card, EmptyState } from "@/components/ui";
import { api } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Recap {
  share_id: string;
  game_type: string;
  mode?: string | null;
  winner_name?: string | null;
  highlights?: string[];
  created_at: string;
}

function gameName(type: string) {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function day(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function GroupTimeline({ groupId }: { groupId: string }) {
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getGroupRecaps(groupId)
      .then((data) => setRecaps(data || []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load recaps"),
      );
  }, [groupId]);

  return (
    <section className="mt-8" aria-labelledby="timeline-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-primary">Running jokes and rivalries</p>
          <h2 id="timeline-title" className="font-display text-2xl font-semibold">
            Group lore timeline
          </h2>
        </div>
        <Badge tone="accent">{recaps.length} recaps</Badge>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {recaps.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon="dice"
            title="The timeline starts after your first game"
            description="Finished sessions become shareable recaps with the winner and memorable answers."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recaps.slice(0, 6).map((recap) => (
            <Link key={recap.share_id} href={`/recap/${recap.share_id}`} className="block">
              <Card className="h-full p-4 transition-colors hover:bg-surface-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="primary">{gameName(recap.game_type)}</Badge>
                  <span className="text-xs font-semibold text-muted">{day(recap.created_at)}</span>
                </div>
                <p className="mt-3 font-display text-lg font-bold">
                  {recap.winner_name ? `${recap.winner_name} took it` : "No winner"}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">
                  {recap.highlights?.[1] || recap.highlights?.[0] || "A finished game with no highlights."}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  Open recap <Icon name="arrow-right" className="h-3.5 w-3.5" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
