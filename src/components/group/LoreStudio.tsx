"use client";

import { Icon } from "@/components/ui/Icon";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { api } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

interface LorePack {
  id: string;
  status: "draft" | "approved" | "archived";
  version: number;
  prompts: { id: string; text: string }[];
  answers: { id: string; text: string; author: string }[];
  approved_at?: string | null;
  created_at: string;
}

export default function LoreStudio({
  groupId,
  isOwner,
}: {
  groupId: string;
  isOwner: boolean;
}) {
  const [optIn, setOptIn] = useState(false);
  const [packs, setPacks] = useState<LorePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.getLore(groupId);
      setOptIn(Boolean(data.optIn));
      setPacks(data.packs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load group lore");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleOptIn = async () => {
    setBusy("opt-in");
    setError("");
    try {
      const next = await api.setLoreOptIn(groupId, !optIn);
      setOptIn(Boolean(next.optIn));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update consent");
    } finally {
      setBusy("");
    }
  };

  const generate = async () => {
    setBusy("generate");
    setError("");
    try {
      await api.generateLorePack(groupId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a pack");
    } finally {
      setBusy("");
    }
  };

  const approve = async (packId: string) => {
    setBusy(packId);
    setError("");
    try {
      await api.approveLorePack(groupId, packId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve the pack");
    } finally {
      setBusy("");
    }
  };

  const latestApproved = packs.find((pack) => pack.status === "approved");

  return (
    <section className="mt-8" aria-labelledby="lore-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-primary">Personalized, with consent</p>
          <h2 id="lore-title" className="font-display text-2xl font-semibold">
            Group lore studio
          </h2>
        </div>
        {isOwner ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "opt-in"}
            onClick={() => void toggleOptIn()}
          >
            {optIn ? "Turn lore off" : "Opt in to lore"}
          </Button>
        ) : (
          <Badge tone={optIn ? "success" : "neutral"}>
            {optIn ? "Group opted in" : "Owner has not opted in"}
          </Badge>
        )}
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon name="sparkles" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              Generated locally from your group’s own profiles and finished games.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Nothing is sent to a model. A pack stays a draft until the owner
              approves it, and approved prompts are only used when lore mode is
              enabled for the deployment. Games fall back to their static banks.
            </p>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}

        {isOwner && optIn ? (
          <Button
            className="mt-4"
            loading={busy === "generate"}
            onClick={() => void generate()}
          >
            Generate a new draft
          </Button>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading lore packs…</p>
        ) : packs.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="sparkles"
              title="No lore packs yet"
              description={
                optIn
                  ? "Generate a draft from the member profiles above."
                  : "The group owner can opt in, then generate a private draft."
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {packs.slice(0, 4).map((pack) => (
              <div
                key={pack.id}
                className="rounded-xl border border-border bg-surface-2/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      pack.status === "approved"
                        ? "success"
                        : pack.status === "draft"
                          ? "accent"
                          : "neutral"
                    }
                  >
                    {pack.status}
                  </Badge>
                  <span className="text-sm font-bold">Version {pack.version}</span>
                  <span className="text-xs text-muted">
                    {pack.prompts.length} prompts · {pack.answers.length} answer cards
                  </span>
                  {isOwner && pack.status === "draft" ? (
                    <Button
                      size="sm"
                      className="ml-auto"
                      loading={busy === pack.id}
                      onClick={() => void approve(pack.id)}
                    >
                      Approve
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {pack.prompts[0]?.text || "No prompts in this pack."}
                </p>
              </div>
            ))}
          </div>
        )}

        {latestApproved ? (
          <p className="mt-4 text-xs font-semibold text-success">
            <Icon name="check" className="mr-1 inline h-3.5 w-3.5" />
            Approved version {latestApproved.version} is live for lore-enabled games.
          </p>
        ) : null}
      </Card>
    </section>
  );
}
