"use client";

import { Icon } from "@/components/ui/Icon";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Recap = {
  share_id: string;
  game_type: string;
  mode?: string | null;
  winner_name?: string | null;
  winner_names?: string[];
  highlights?: string[];
  scores?: { name: string; score: number; winner: boolean }[];
  created_at: string;
  groups?: { name?: string } | { name?: string }[] | null;
};

function gameName(type: string) {
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function RecapPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getRecap(shareId)
      .then(setRecap)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load the recap"),
      );
  }, [shareId]);

  const share = async () => {
    if (!recap) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${recap.winner_name || "GroupLore"} recap`,
          text: recap.highlights?.[0] || "See the result",
          url,
        });
        return;
      } catch {
        // Fall through to copying when the share sheet is dismissed.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const groupValue = recap?.groups;
  const groupName = Array.isArray(groupValue)
    ? groupValue[0]?.name
    : groupValue?.name;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="font-display text-xl font-black tracking-tight">
          GroupLore
        </Link>
        <Link href="/games" className="text-sm font-bold text-primary">
          Play with your group →
        </Link>
      </div>

      {error ? (
        <Card className="p-8 text-center">
          <Icon name="flag" className="mx-auto h-8 w-8" />
          <h1 className="mt-3 font-display text-2xl font-bold">Recap not found</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
        </Card>
      ) : !recap ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          <Card variant="raised" className="overflow-hidden">
            <div className="bg-primary-soft p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{gameName(recap.game_type)}</Badge>
                {recap.mode ? <Badge>{recap.mode}</Badge> : null}
                <span className="text-xs font-semibold text-muted">
                  {new Date(recap.created_at).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {groupName || "A GroupLore session"}
              </p>
              <h1 className="mt-2 font-display text-4xl font-black leading-none sm:text-5xl">
                {recap.winner_name || "No winner"}
              </h1>
              <p className="mt-3 text-base font-semibold text-ink/70">
                {recap.winner_names && recap.winner_names.length > 1
                  ? "Shared the win"
                  : "Took the crown"}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <h2 className="font-display text-xl font-bold">Memorable moments</h2>
              <div className="mt-3 grid gap-2">
                {(recap.highlights || []).map((highlight, index) => (
                  <p
                    key={`${index}-${highlight}`}
                    className="rounded-xl border border-border bg-surface-2/50 px-4 py-3 text-sm font-semibold"
                  >
                    {highlight}
                  </p>
                ))}
                {!recap.highlights?.length ? (
                  <p className="text-sm text-muted">No moments were recorded.</p>
                ) : null}
              </div>

              <h2 className="mt-6 font-display text-xl font-bold">Final table</h2>
              <div className="mt-3 divide-y divide-border">
                {(recap.scores || []).map((score, index) => (
                  <div key={score.name} className="flex items-center gap-3 py-2">
                    <span className="w-6 text-center font-mono text-sm font-bold text-muted">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      {score.name}
                    </span>
                    {score.winner ? <Icon name="crown" className="h-4 w-4" /> : null}
                    <span className="font-mono text-lg font-bold">{score.score}</span>
                  </div>
                ))}
              </div>

              <Button className="mt-6 w-full" onClick={() => void share()}>
                <Icon name={copied ? "check" : "link"} className="h-4 w-4" />
                {copied ? "Link copied" : "Share this recap"}
              </Button>
              <p className="mt-3 text-center text-xs text-muted">
                Share cards contain display names and game highlights only.
              </p>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
