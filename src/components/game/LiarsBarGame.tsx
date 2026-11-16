"use client";

import { Card, CardTable, Hand, OpponentSeat, PlayedCards } from "@/components/cards";
import { Badge, Button } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import type { RoomView } from "@/stores/roomStore";
import { useState } from "react";

type LiarsReveal = {
  callerId: string;
  callerName: string;
  playerId: string;
  playerName: string;
  claimed: string;
  cards: { id: string; rank: string; suit?: string; faceUp?: boolean }[];
  wasLie: boolean;
  stamp: "Caught!" | "Honest!";
  loserId: string;
  loserName: string;
  strikes: Record<string, number>;
  eliminated: { playerId: string; name: string }[];
  maxStrikes: number;
};

export type LiarsView = {
  phase: "turn" | "reveal";
  round: number;
  mode: string;
  tableRank: "K" | "Q" | "A" | string;
  currentPlayerId: string | null;
  currentPlayerName: string;
  isYourTurn: boolean;
  hand: { id: string; rank: string; suit?: string; joker?: boolean }[];
  handCounts: Record<string, { count: number; backIds: string[] }>;
  strikes: Record<string, number>;
  maxStrikes: number;
  eliminated: string[];
  pileCount: number;
  lastPlay: { playerId: string; name: string; count: number } | null;
  mustCall: boolean;
  canCall: boolean;
  aliveCount: number;
  turnMs: number;
  reveal?: LiarsReveal | null;
};

export default function LiarsBarGame({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: LiarsView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const youId = room.you?.id || "";
  const youAreOut = view.eliminated.includes(youId);
  const others = room.players.filter((player) => player.id !== youId);
  const seatStatus = (playerId: string) => {
    if (view.eliminated.includes(playerId)) return "Spectating";
    if (playerId === view.currentPlayerId) return "Choosing a play";
    return `${view.handCounts[playerId]?.count ?? 0} cards`;
  };
  const lastCards = view.lastPlay
    ? Array.from({ length: view.lastPlay.count }, (_, index) => ({
        id: `hidden-${index}`,
      }))
    : [];
  const reveal = view.reveal;

  return (
    <div className="space-y-4">
      {youAreOut ? (
        <div className="rounded-[16px] border border-border bg-surface-2 px-4 py-3 text-center">
          <p className="font-display text-lg font-bold text-ink">You are spectating</p>
          <p className="text-sm font-semibold text-muted">
            Your strike limit was reached. The table keeps playing without you.
          </p>
        </div>
      ) : null}

      <CardTable>
        <div className="relative z-[1] grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center justify-center gap-3">
            <Card
              card={{ id: "table-rank", rank: view.tableRank, label: "Table rank" }}
              size="lg"
            />
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-muted">
                Table rank
              </p>
              <p className="font-display text-2xl font-extrabold text-ink">
                {view.tableRank}s
              </p>
              <p className="mt-1 max-w-[18ch] text-xs font-semibold text-muted">
                Play 1–3 cards face-down and claim they match.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <PlayedCards
              cards={reveal ? reveal.cards : lastCards}
              revealed={Boolean(reveal)}
              claimed={
                view.lastPlay
                  ? `${view.lastPlay.name} claimed ${view.lastPlay.count} × ${view.tableRank}`
                  : "Waiting for the first play"
              }
            />
            {view.lastPlay ? (
              <Badge tone={view.isYourTurn && view.canCall ? "danger" : "neutral"}>
                {view.pileCount} cards in the pile
              </Badge>
            ) : null}
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
            strikes={view.strikes[player.id] || 0}
            maxStrikes={view.maxStrikes}
            eliminated={view.eliminated.includes(player.id)}
            isTurn={view.currentPlayerId === player.id}
            status={seatStatus(player.id)}
          />
        ))}
      </div>

      {view.phase === "turn" && !youAreOut ? (
        <div className="rounded-[18px] border border-border bg-surface p-3 shadow-soft">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted">
                {view.isYourTurn ? "Your turn" : `${view.currentPlayerName} is playing`}
              </p>
              <p className="text-sm font-semibold text-ink">
                {view.mustCall
                  ? "Your hand is empty — call liar."
                  : `Select 1–3 cards to play as ${view.tableRank}s.`}
              </p>
            </div>
            <Badge tone="neutral">
              {view.aliveCount} alive · {view.maxStrikes} strike
              {view.maxStrikes === 1 ? "" : "s"}
            </Badge>
          </div>

          <Hand
            cards={view.hand}
            selectedIds={selected}
            onSelect={setSelected}
            max={3}
            disabled={!view.isYourTurn || Boolean(view.lastPlay && view.mustCall)}
            label="Your hand"
            emptyLabel="No cards left. Call liar."
          />

          {view.isYourTurn ? (
            <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Button
                disabled={selected.length < 1 || view.mustCall}
                onClick={() => {
                  send("play", { cardIds: selected });
                  setSelected([]);
                }}
              >
                <Icon name="play" className="h-4 w-4" />
                Play {selected.length || ""} card{selected.length === 1 ? "" : "s"}
              </Button>
              <Button
                variant="danger"
                disabled={!view.canCall}
                onClick={() => send("call")}
              >
                Call liar
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-center text-xs font-semibold text-muted">
              Cards stay face-down until a call.
            </p>
          )}
        </div>
      ) : null}

      {view.phase === "reveal" && reveal ? (
        <div
          className={`rounded-[18px] border p-5 text-center shadow-soft ${
            reveal.wasLie
              ? "border-danger/40 bg-danger/10"
              : "border-success/40 bg-success/10"
          }`}
          aria-live="polite"
        >
          <p className="font-display text-4xl font-black italic tracking-[-.06em] text-ink">
            {reveal.stamp}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {reveal.wasLie
              ? `${reveal.playerName} claimed ${reveal.claimed}s without matching cards.`
              : `${reveal.callerName} called a truthful claim.`}
          </p>
          <p className="mt-3 rounded-full bg-surface px-4 py-2 font-display text-lg font-bold text-ink">
            {reveal.loserName} takes a strike
          </p>
          <p className="mt-2 text-xs font-semibold text-muted">
            Strikes:{" "}
            {Object.entries(reveal.strikes)
              .map(([id, strikes]) => `${room.players.find((p) => p.id === id)?.name || "Player"} ${strikes}/${reveal.maxStrikes}`)
              .join(" · ")}
          </p>
          {reveal.eliminated.length ? (
            <p className="mt-2 text-xs font-bold text-danger">
              Out: {reveal.eliminated.map((entry) => entry.name).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {view.phase === "turn" && !view.isYourTurn ? (
        <p className="text-center text-xs font-semibold text-muted" aria-live="polite">
          Waiting for {view.currentPlayerName}. The turn timer will make the lowest play.
        </p>
      ) : null}
    </div>
  );
}
