"use client";

import { Card, CardTable, Hand, OpponentSeat, PlayedCards } from "@/components/cards";
import { Badge, Button } from "@/components/ui";
import type { RoomView } from "@/stores/roomStore";
import { useState } from "react";

type CheatReveal = {
  callerId?: string;
  callerName?: string;
  playerId: string;
  playerName: string;
  claimedRank: string;
  cards: { id: string; rank: string; suit?: string }[];
  wasLie: boolean;
  stamp: string;
  pickerId?: string;
  pickerName?: string;
  starterName?: string;
  autoWin?: boolean;
};

export type CheatView = {
  phase: "turn" | "reveal";
  mode: string;
  currentPlayerId: string | null;
  currentPlayerName: string;
  isYourTurn: boolean;
  hand: { id: string; rank: string; suit?: string }[];
  handCounts: Record<string, { count: number; backIds: string[] }>;
  claimedRank: string;
  pileCount: number;
  lastPlay: {
    playerId: string;
    playerName: string;
    count: number;
    claimedRank: string;
  } | null;
  canCall: boolean;
  maxPlay: number;
  turnMs: number;
  reveal?: CheatReveal | null;
  winnerId?: string | null;
};

export default function CheatGame({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: CheatView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const youId = room.you?.id || "";
  const others = room.players.filter((player) => player.id !== youId);
  const lastCards = view.lastPlay
    ? Array.from({ length: view.lastPlay.count }, (_, index) => ({
        id: `hidden-cheat-${index}`,
      }))
    : [];

  return (
    <div className="space-y-4">
      <CardTable>
        <div className="relative z-[1] grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center justify-center gap-3">
            <Card
              card={{ id: "claim", rank: view.claimedRank, label: "Claimed rank" }}
              size="lg"
            />
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-muted">
                Claim this rank
              </p>
              <p className="font-display text-2xl font-extrabold text-ink">
                {view.claimedRank}s
              </p>
              <p className="mt-1 max-w-[20ch] text-xs font-semibold text-muted">
                Lay 1–{view.maxPlay} cards face-down. Nobody sees the faces.
              </p>
            </div>
          </div>
          <div>
            <PlayedCards
              cards={
                view.reveal && view.reveal.cards.length
                  ? view.reveal.cards
                  : lastCards
              }
              revealed={Boolean(view.reveal?.cards.length)}
              claimed={
                view.lastPlay
                  ? `${view.lastPlay.playerName} played ${view.lastPlay.count} as ${view.lastPlay.claimedRank}s`
                  : "The pile is empty"
              }
            />
          </div>
        </div>
      </CardTable>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((player) => (
          <OpponentSeat
            key={player.id}
            name={player.name}
            avatarUrl={player.avatarUrl}
            cardCount={view.handCounts[player.id]?.count ?? 0}
            isTurn={view.currentPlayerId === player.id}
            status={
              view.currentPlayerId === player.id
                ? "Deciding what to claim"
                : `${view.handCounts[player.id]?.count ?? 0} cards`
            }
          />
        ))}
      </div>

      {view.phase === "turn" ? (
        <div className="rounded-[18px] border border-border bg-surface p-3 shadow-soft">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted">
                {view.isYourTurn ? "Your turn" : `${view.currentPlayerName} is playing`}
              </p>
              <p className="text-sm font-semibold text-ink">
                {view.isYourTurn
                  ? `Select cards to claim as ${view.claimedRank}s.`
                  : "Watch the pile — you can call cheat on your turn."}
              </p>
            </div>
            <Badge tone="neutral">{view.pileCount} in the pile</Badge>
          </div>
          <Hand
            cards={view.hand}
            selectedIds={selected}
            onSelect={setSelected}
            max={view.maxPlay}
            disabled={!view.isYourTurn}
            label="Your hand"
            emptyLabel="No cards left."
          />
          {view.isYourTurn ? (
            <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Button
                disabled={selected.length < 1}
                onClick={() => {
                  send("play", { cardIds: selected });
                  setSelected([]);
                }}
              >
                Claim {view.claimedRank}s · play {selected.length || ""}
              </Button>
              <Button
                variant="danger"
                disabled={!view.canCall}
                onClick={() => send("call")}
              >
                Call cheat
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {view.phase === "reveal" && view.reveal ? (
        <div
          className={`rounded-[18px] border p-5 text-center shadow-soft ${
            view.reveal.wasLie
              ? "border-danger/40 bg-danger/10"
              : "border-success/40 bg-success/10"
          }`}
          aria-live="polite"
        >
          <p className="font-display text-4xl font-black italic tracking-[-.06em] text-ink">
            {view.reveal.stamp}
          </p>
          {view.reveal.autoWin ? (
            <p className="mt-1 text-sm font-semibold text-muted">
              {view.reveal.playerName} got rid of every card.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold text-muted">
                {view.reveal.wasLie
                  ? `${view.reveal.playerName} claimed ${view.reveal.claimedRank}s without matching cards.`
                  : `${view.reveal.callerName} called a truthful claim.`}
              </p>
              <p className="mt-3 rounded-full bg-surface px-4 py-2 font-display text-lg font-bold text-ink">
                {view.reveal.pickerName} picks up the pile
              </p>
              <p className="mt-1 text-xs font-semibold text-muted">
                {view.reveal.starterName} starts the next round.
              </p>
            </>
          )}
        </div>
      ) : null}

      {view.phase === "turn" && !view.isYourTurn ? (
        <p className="text-center text-xs font-semibold text-muted" aria-live="polite">
          Waiting for {view.currentPlayerName}. Timeout plays their lowest card.
        </p>
      ) : null}
    </div>
  );
}
