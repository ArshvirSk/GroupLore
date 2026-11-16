"use client";

import { Avatar, Badge, cn } from "@/components/ui";
import { motion, useReducedMotion } from "framer-motion";
import { useRef, type CSSProperties, type ReactNode } from "react";

export type PlayingCard = {
  id: string;
  rank?: string | number;
  suit?: "spades" | "hearts" | "diamonds" | "clubs" | string;
  label?: string;
  text?: string;
  color?: "red" | "black" | string;
  faceUp?: boolean;
  joker?: boolean;
};

const SUIT_GLYPH: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const CARD_SIZES = {
  sm: "h-[74px] w-[52px] text-[10px]",
  md: "h-[108px] w-[76px] text-xs",
  lg: "h-[136px] w-[96px] text-sm",
};

function suitGlyph(card: PlayingCard) {
  if (card.joker) return "★";
  return SUIT_GLYPH[card.suit || ""] || "◆";
}

function faceColor(card: PlayingCard) {
  if (card.joker) return "var(--primary-ink)";
  if (card.color === "red" || card.suit === "hearts" || card.suit === "diamonds") {
    return "var(--danger)";
  }
  return "var(--ink)";
}

export function Card({
  card,
  faceUp = true,
  size = "md",
  selected = false,
  disabled = false,
  onClick,
  className = "",
  style,
}: {
  card: PlayingCard;
  faceUp?: boolean;
  size?: keyof typeof CARD_SIZES;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  const label = faceUp
    ? card.label ||
      `${card.joker ? "Joker" : card.rank || "Card"}${card.suit ? ` of ${card.suit}` : ""}`
    : "Face-down card";
  const glyph = suitGlyph(card);
  const content = faceUp && card.text ? (
    <span className="card-face card-face-text">
      <span className="card-text">{card.text}</span>
    </span>
  ) : faceUp ? (
    <span className="card-face" style={{ color: faceColor(card) }}>
      <span className="card-corner">
        <b>{card.joker ? "JOKER" : card.rank}</b>
        <span aria-hidden>{glyph}</span>
      </span>
      <span className="card-center" aria-hidden>
        {glyph}
      </span>
      {card.label ? <span className="card-caption">{card.label}</span> : null}
      <span className="card-corner card-corner-bottom" aria-hidden>
        <b>{card.joker ? "★" : card.rank}</b>
        <span>{glyph}</span>
      </span>
    </span>
  ) : (
    <span className="card-back" aria-hidden>
      <span className="card-back-mark">GL</span>
      <span className="card-back-star">✦</span>
    </span>
  );

  const classes = cn(
    "card-shell shrink-0 rounded-[10px] border",
    CARD_SIZES[size],
    faceUp ? "card-front" : "card-reverse",
    selected && "card-selected",
    disabled && "opacity-45",
    onClick && "cursor-pointer",
    className,
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        aria-pressed={selected}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        whileHover={reduced || disabled ? undefined : { y: -7 }}
        whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={classes}
        style={style}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <span className={classes} style={style} role="img" aria-label={label}>
      {content}
    </span>
  );
}

export function Hand({
  cards,
  selectedIds = [],
  onSelect,
  max = 1,
  faceUp = true,
  disabled = false,
  size = "md",
  label = "Your hand",
  emptyLabel = "No cards in hand",
}: {
  cards: PlayingCard[];
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  max?: number;
  faceUp?: boolean;
  disabled?: boolean;
  size?: keyof typeof CARD_SIZES;
  label?: string;
  emptyLabel?: string;
}) {
  const dragging = useRef(false);
  const skipClick = useRef(false);
  const middle = (cards.length - 1) / 2;

  const toggle = (id: string) => {
    if (!onSelect || disabled) return;
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter((value) => value !== id));
      return;
    }
    if (selectedIds.length >= max) return;
    onSelect([...selectedIds, id]);
  };

  if (!cards.length) {
    return (
      <p className="rounded-[14px] border border-dashed border-border bg-surface-2/60 px-4 py-5 text-center text-sm font-semibold text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div
      className="card-hand"
      role="group"
      aria-label={`${label}${selectedIds.length ? `, ${selectedIds.length} selected` : ""}`}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerLeave={() => {
        dragging.current = false;
      }}
    >
      {cards.map((card, index) => {
        const active = selectedIds.includes(card.id);
        return (
          <span
            key={card.id}
            className="card-hand-slot"
            style={
              {
                "--card-tilt": `${(index - middle) * 4}deg`,
                "--card-lift": `${Math.abs(index - middle) * 3}px`,
                "--card-index": index,
              } as CSSProperties
            }
          >
            <Card
              card={card}
              faceUp={faceUp}
              size={size}
              selected={active}
              disabled={disabled}
              onClick={
                onSelect
                  ? () => {
                      if (skipClick.current) {
                        skipClick.current = false;
                        return;
                      }
                      toggle(card.id);
                    }
                  : undefined
              }
            />
            {onSelect ? (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className="card-hand-drag-surface"
                onPointerDown={() => {
                  if (disabled) return;
                  skipClick.current = true;
                  dragging.current = true;
                  if (!active) toggle(card.id);
                }}
                onPointerEnter={() => {
                  if (disabled || !dragging.current) return;
                  if (!active) toggle(card.id);
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function Pile({
  count,
  label = "Deck",
  topCard,
  faceUp = false,
  size = "sm",
}: {
  count: number;
  label?: string;
  topCard?: PlayingCard | null;
  faceUp?: boolean;
  size?: keyof typeof CARD_SIZES;
}) {
  return (
    <div className="card-pile" aria-label={`${label}: ${count} cards`}>
      <div className="card-pile-stack" aria-hidden>
        {[0, 1, 2].map((layer) => (
          <span
            key={layer}
            className="card-pile-layer"
            style={{ transform: `translate(${layer * 2}px, ${-layer * 2}px)` }}
          >
            <Card
              card={topCard || { id: `pile-${layer}` }}
              faceUp={Boolean(faceUp && topCard && layer === 0)}
              size={size}
            />
          </span>
        ))}
      </div>
      <span className="card-pile-count">{count}</span>
      <span className="card-pile-label">{label}</span>
    </div>
  );
}

export function PlayedCards({
  cards,
  revealed = false,
  claimed = "",
  label = "Cards on the table",
}: {
  cards: PlayingCard[];
  revealed?: boolean;
  claimed?: string;
  label?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="card-played" aria-live="polite">
      <div className="card-played-row">
        {cards.length ? (
          cards.map((card, index) => (
            <motion.span
              key={card.id}
              initial={
                reduced
                  ? false
                  : { opacity: 0, y: -18, x: index * 3, rotate: -8 + index * 3 }
              }
              animate={{ opacity: 1, y: 0, x: index * 4, rotate: -5 + index * 4 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{ zIndex: index }}
            >
              <Card card={card} faceUp={revealed} size="lg" />
            </motion.span>
          ))
        ) : (
          <span className="card-empty-slot">No cards played yet</span>
        )}
      </div>
      <p className="card-played-label">
        {claimed || label}
        {cards.length ? ` · ${cards.length} card${cards.length === 1 ? "" : "s"}` : ""}
      </p>
    </div>
  );
}

export function OpponentSeat({
  name,
  avatarUrl,
  cardCount,
  status,
  strikes = 0,
  maxStrikes = 0,
  eliminated = false,
  isTurn = false,
}: {
  name: string;
  avatarUrl?: string | null;
  cardCount: number;
  status?: string;
  strikes?: number;
  maxStrikes?: number;
  eliminated?: boolean;
  isTurn?: boolean;
}) {
  return (
    <div
      className={cn(
        "card-seat",
        isTurn && "card-seat-active",
        eliminated && "card-seat-eliminated",
      )}
      aria-label={`${name}, ${cardCount} cards${eliminated ? ", eliminated" : ""}`}
    >
      <Avatar name={name} src={avatarUrl} size="sm" connected={!eliminated} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-ink">{name}</p>
        <p className="text-[10px] font-semibold text-muted">
          {eliminated ? "Spectating" : status || `${cardCount} cards`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!eliminated ? (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-ink">
            {cardCount}
          </span>
        ) : null}
        {maxStrikes > 0 ? (
          <span className="flex gap-0.5" aria-label={`${strikes} of ${maxStrikes} strikes`}>
            {Array.from({ length: maxStrikes }).map((_, index) => (
              <span
                key={index}
                className={cn("card-strike", index < strikes && "is-filled")}
              />
            ))}
          </span>
        ) : null}
        {isTurn ? <Badge tone="accent">Turn</Badge> : null}
      </div>
    </div>
  );
}

export function CardTable({ children }: { children: ReactNode }) {
  return <div className="card-table">{children}</div>;
}
