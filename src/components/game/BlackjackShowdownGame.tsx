"use client";

import { Card } from "@/components/cards";
import { Badge, Button } from "@/components/ui";
import type { RoomView } from "@/stores/roomStore";

type BlackjackCard = { id: string; rank: string; suit?: string; value?: number };
type Result = { outcome: string; delta: number };
type BlackjackReveal = {
  dealer: { total: number; blackjack: boolean };
  dealerCards: BlackjackCard[];
  hands: Record<string, BlackjackCard[]>;
  totals: Record<string, number>;
  results: Record<string, Result>;
  chips: Record<string, number>;
};

export type BlackjackView = {
  phase: "turn" | "reveal";
  round: number;
  rounds: number;
  mode: string;
  bet: number;
  chips: number;
  hand: BlackjackCard[];
  handValue: number;
  soft: boolean;
  dealerUp: BlackjackCard | null;
  dealerHidden: number;
  dealerTotal: number | null;
  currentPlayerId: string | null;
  currentPlayerName: string;
  isYourTurn: boolean;
  canHit: boolean;
  acted: Record<string, string>;
  handCounts: Record<string, number>;
  reveal?: BlackjackReveal | null;
  turnMs: number;
};

const outcomeLabel: Record<string, string> = {
  win: "Win",
  blackjack: "Blackjack",
  push: "Push",
  lose: "Dealer wins",
  bust: "Bust",
};

export default function BlackjackShowdownGame({
  room,
  view,
  send,
}: {
  room: RoomView;
  view: BlackjackView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const others = room.players.filter((player) => player.id !== room.you?.id);
  const reveal = view.reveal;

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-border bg-cream p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-muted">
              Round {view.round} of {view.rounds}
            </p>
            <p className="font-display text-xl font-extrabold text-ink">
              Dealer
              {reveal
                ? ` · ${reveal.dealer.total}${reveal.dealer.blackjack ? " blackjack" : ""}`
                : view.dealerTotal
                  ? ` · ${view.dealerTotal}`
                  : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Bet {view.bet}</Badge>
            <Badge tone="success">{view.chips} chips</Badge>
          </div>
        </div>
        <div className="card-played-row mt-3 !min-h-[132px]">
          {reveal
            ? reveal.dealerCards.map((card) => (
                <Card key={card.id} card={card} size="md" />
              ))
            : view.dealerUp
              ? [
                  <Card key={view.dealerUp.id} card={view.dealerUp} size="md" />,
                  ...Array.from({ length: view.dealerHidden }, (_, index) => (
                    <Card
                      key={`hole-${index}`}
                      card={{ id: `hole-${index}`, rank: "?" }}
                      faceUp={false}
                      size="md"
                    />
                  )),
                ]
              : null}
        </div>
      </div>

      <div className="rounded-[18px] border border-border bg-surface p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-muted">
              Your hand
            </p>
            <p className="font-display text-2xl font-extrabold text-ink">
              {reveal ? reveal.totals[room.you?.id || ""] : view.handValue}
              {view.soft ? " soft" : ""}
            </p>
          </div>
          <Badge tone={view.isYourTurn ? "success" : "neutral"}>
            {view.isYourTurn ? "Your turn" : `${view.currentPlayerName} acting`}
          </Badge>
        </div>
        <div className="card-played-row mt-2 !min-h-[150px]">
          {(reveal?.hands[room.you?.id || ""] || view.hand).map((card) => (
            <Card key={card.id} card={card} size="md" />
          ))}
        </div>
        {reveal ? (
          <p className="mt-2 rounded-full bg-surface-2 px-3 py-2 text-center text-sm font-bold text-ink">
            {outcomeLabel[reveal.results[room.you?.id || ""]?.outcome] ||
              "Round over"}
            {reveal.results[room.you?.id || ""]?.delta
              ? ` · ${reveal.results[room.you?.id || ""].delta > 0 ? "+" : ""}${reveal.results[room.you?.id || ""].delta}`
              : ""}
          </p>
        ) : view.isYourTurn ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              disabled={!view.canHit}
              onClick={() => send("hit")}
            >
              Hit
            </Button>
            <Button variant="secondary" onClick={() => send("stand")}>
              Stand
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-center text-xs font-semibold text-muted">
            Waiting for {view.currentPlayerName}.
          </p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((player) => {
          const result = reveal?.results[player.id];
          const cards = reveal?.hands[player.id] || [];
          return (
            <div
              key={player.id}
              className="rounded-[14px] border border-border bg-surface px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-display text-sm font-bold text-ink">
                  {player.name}
                </p>
                <span className="shrink-0 text-[11px] font-bold uppercase text-muted">
                  {result
                    ? outcomeLabel[result.outcome] || result.outcome
                    : view.acted[player.id]
                      ? "Stood"
                      : `${view.handCounts[player.id] || 0} cards`}
                </span>
              </div>
              {reveal ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {cards.map((card) => (
                    <span
                      key={card.id}
                      className="rounded-md border border-border bg-surface-2 px-1.5 py-1 font-mono text-xs font-bold text-ink"
                    >
                      {card.rank}
                      {card.suit || ""}
                    </span>
                  ))}
                  <span className="px-1 py-1 text-xs font-bold text-muted">
                    {reveal.totals[player.id]}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {reveal ? (
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Chip counts
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(reveal.chips).map(([playerId, chips]) => (
              <Badge key={playerId} tone="neutral">
                {room.players.find((player) => player.id === playerId)?.name ||
                  "Player"}
                : {chips}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
