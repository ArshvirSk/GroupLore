"use client";

import { Card } from "@/components/cards";
import { Badge, Button } from "@/components/ui";
import type { RoomView } from "@/stores/roomStore";

type Token = {
  id: string;
  playerId: string;
  kind: "safe" | "hazard";
  faceUp?: boolean;
};

type SkullReveal = {
  bidderId: string;
  bidderName: string;
  bid: number;
  tokens: Token[];
  hitHazard: boolean;
  success: boolean;
  wins: Record<string, number>;
  targetWins: number;
};

export type SkullView = {
  phase: "place" | "bid" | "reveal";
  round: number;
  mode: string;
  targetWins: number;
  wins: Record<string, number>;
  tokens: Token[];
  lost: string[];
  placedTokenId: string | null;
  placedCount: number;
  placedPlayers: string[];
  submitted: number;
  total: number;
  yourBid: number | null;
  bidsSubmitted: number;
  reveal?: SkullReveal | null;
};

export default function SkullDuelGame({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: SkullView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const youId = room.you?.id || "";
  const others = room.players.filter((player) => player.id !== youId);
  const lost = new Set(view.lost);

  return (
    <div className="space-y-4">
      <div className="party-card bg-[color-mix(in_srgb,var(--accent-soft)_60%,var(--surface))] p-5 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-muted">
          Round {view.round} · First to {view.targetWins}
        </p>
        <p className="mt-1 font-display text-3xl font-black tracking-[-.04em] text-ink">
          Skull Duel
        </p>
        <p className="mt-1 text-sm font-semibold text-muted">
          Hide one token. Bid a flip count. One hazard ends the challenge.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {room.players.map((player) => (
            <Badge key={player.id} tone="neutral">
              {player.name}: {view.wins[player.id] || 0}/{view.targetWins}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {view.tokens.map((token) => {
          const isLost = lost.has(token.id);
          const isPlaced = view.placedTokenId === token.id;
          return (
            <button
              key={token.id}
              type="button"
              disabled={
                isLost ||
                Boolean(view.placedTokenId) ||
                view.phase !== "place"
              }
              onClick={() => send("place", { tokenId: token.id })}
              className={`rounded-[16px] border-2 p-3 text-left shadow-soft transition ${
                token.kind === "hazard"
                  ? "border-danger/30 bg-danger/10"
                  : "border-border bg-surface"
              } ${isPlaced ? "ring-2 ring-accent" : ""} disabled:opacity-50`}
            >
              <span className="text-2xl">{token.kind === "hazard" ? "☠️" : "🛡️"}</span>
              <span className="mt-1 block font-display text-sm font-bold text-ink">
                {token.kind === "hazard" ? "Hazard" : "Safe"}
              </span>
              <span className="text-[11px] font-semibold text-muted">
                {isLost ? "Lost" : isPlaced ? "Placed" : "In reserve"}
              </span>
            </button>
          );
        })}
      </div>

      {view.phase === "place" ? (
        <div className="rounded-[18px] border border-border bg-surface p-4 text-center">
          <p className="font-display text-lg font-bold text-ink">
            Place one token face-down
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {view.placedTokenId
              ? "Locked in. Waiting for the rest of the table."
              : "Tap a token above. Only you know which one is the hazard."}
          </p>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
            {view.submitted}/{view.total} placed
          </p>
        </div>
      ) : null}

      {view.phase === "bid" ? (
        <div className="rounded-[18px] border border-border bg-surface p-4">
          <p className="text-center font-display text-lg font-bold text-ink">
            How many can you flip without a hazard?
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {Array.from({ length: view.placedCount }, (_, index) => index + 1).map(
              (value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={view.yourBid === value ? "primary" : "secondary"}
                  disabled={view.yourBid !== null}
                  onClick={() => send("bid", { value })}
                >
                  {value}
                </Button>
              ),
            )}
          </div>
          <p className="mt-3 text-center text-xs font-bold uppercase tracking-wide text-muted">
            {view.yourBid
              ? `Your bid: ${view.yourBid}`
              : "Pick a number"}{" "}
            · {view.bidsSubmitted}/{view.total} bid
          </p>
        </div>
      ) : null}

      {view.phase === "reveal" && view.reveal ? (
        <div
          className={`rounded-[18px] border p-5 text-center shadow-soft ${
            view.reveal.hitHazard
              ? "border-danger/40 bg-danger/10"
              : "border-success/40 bg-success/10"
          }`}
          aria-live="polite"
        >
          <p className="font-display text-4xl font-black italic tracking-[-.06em] text-ink">
            {view.reveal.hitHazard ? "Hazard!" : "Clean sweep!"}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {view.reveal.bidderName} bid {view.reveal.bid}.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {view.reveal.tokens.map((token) => (
              <Card
                key={token.id}
                card={{
                  id: token.id,
                  rank: token.kind === "hazard" ? "☠" : "🛡",
                  label:
                    token.kind === "hazard"
                      ? "Hazard"
                      : "Safe",
                }}
                size="md"
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-muted">
            {view.reveal.hitHazard
              ? "The challenger loses a token and the hazard is spent."
              : "One step closer to the duel win."}
          </p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        {others.map((player) => (
          <div
            key={player.id}
            className="rounded-[14px] border border-border bg-surface px-3 py-2"
          >
            <p className="truncate font-display text-sm font-bold text-ink">
              {player.name}
            </p>
            <p className="text-[11px] font-semibold text-muted">
              {view.wins[player.id] || 0} win
              {(view.wins[player.id] || 0) === 1 ? "" : "s"} ·{" "}
              {view.placedPlayers.includes(player.id) ? "placed" : "waiting"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
