"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { useState, type CSSProperties, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Shared player primitives                                            */
/* ------------------------------------------------------------------ */

export type HudPlayer = {
  id: string;
  name: string;
  score: number;
  avatarUrl?: string | null;
  connected?: boolean;
  teamColor?: string | null;
  teamName?: string | null;
};

const TINTS = ["#bfa0f4", "#f29bcb", "#8edceb", "#d7f45b", "#ffc857", "#eadcfb"];

export function tintOf(name: string) {
  const base = TINTS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TINTS.length];
  // Mix with the theme surface so avatar tints stay legible in dark mode too.
  return `color-mix(in srgb, ${base} 45%, var(--surface))`;
}

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

const TOKEN_SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-14 w-14 text-base",
};

export type PlayerState = "idle" | "turn" | "ready" | "typing" | "out";

/** Avatar with a state ring: whose turn, who is done, who is typing. */
export function PlayerToken({
  name,
  avatarUrl,
  size = "md",
  state = "idle",
  teamColor,
  showStateBadge = true,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof TOKEN_SIZES;
  state?: PlayerState;
  teamColor?: string | null;
  showStateBadge?: boolean;
}) {
  const reduced = useReducedMotion();
  const ring =
    state === "turn"
      ? "0 0 0 3px var(--accent)"
      : state === "ready"
        ? "0 0 0 3px var(--success)"
        : teamColor
          ? `0 0 0 3px ${teamColor}`
          : "0 0 0 1px color-mix(in srgb, var(--ink) 18%, transparent)";
  return (
    <span className="relative inline-flex shrink-0">
      {state === "turn" && !reduced ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: "0 0 0 3px var(--accent)" }}
          animate={{ opacity: [1, 0.25, 1], scale: [1, 1.12, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      <span
        className={`${TOKEN_SIZES[size]} relative flex items-center justify-center overflow-hidden rounded-full font-display font-semibold text-ink transition-[box-shadow,filter] ${
          state === "out" ? "opacity-40 grayscale" : ""
        }`}
        style={{ background: tintOf(name), boxShadow: ring }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsOf(name)
        )}
      </span>
      {showStateBadge && state === "ready" ? (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface bg-success text-on-success">
          <Icon name="check" className="h-2.5 w-2.5" />
        </span>
      ) : null}
      {showStateBadge && state === "typing" ? (
        <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full border border-border bg-surface px-1.5 py-0.5">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-1 w-1 rounded-full bg-ink"
              animate={reduced ? undefined : { opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1, repeat: Infinity, delay: dot * 0.15 }}
            />
          ))}
        </span>
      ) : null}
      {state === "out" ? (
        <span className="absolute inset-0 flex items-center justify-center text-danger">
          <Icon name="close" className="h-4 w-4" />
        </span>
      ) : null}
    </span>
  );
}

export function PlayerStrip({
  players,
  youId,
  turnId,
  readyIds = [],
  typingIds = [],
  outIds = [],
  className = "",
  label = "Players",
}: {
  players: HudPlayer[];
  youId?: string | null;
  turnId?: string | null;
  readyIds?: string[];
  typingIds?: string[];
  outIds?: string[];
  className?: string;
  label?: string;
}) {
  if (!players.length) return null;
  return (
    <div
      aria-label={label}
      className={`flex flex-wrap items-start gap-3 rounded-[18px] border border-border bg-surface px-4 py-3 shadow-soft ${className}`}
    >
      {players.map((player) => {
        const state: PlayerState = outIds.includes(player.id)
          ? "out"
          : player.id === turnId
            ? "turn"
            : typingIds.includes(player.id)
              ? "typing"
              : readyIds.includes(player.id)
                ? "ready"
                : "idle";
        return (
          <div key={player.id} className="flex w-14 flex-col items-center gap-1">
            <PlayerToken
              name={player.name}
              avatarUrl={player.avatarUrl}
              state={state}
              teamColor={player.teamColor}
            />
            <span className="w-full truncate text-center text-[10px] font-semibold text-muted">
              {player.id === youId ? "You" : player.name.split(" ").slice(-1)[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Race track                                                          */
/* ------------------------------------------------------------------ */

export function RaceTrack({
  players,
  progress,
  youId,
  onLaneLabel,
}: {
  players: HudPlayer[];
  /** 0..1 per player id; players at 1 are finished. */
  progress: Record<string, number>;
  youId?: string | null;
  onLaneLabel?: (player: HudPlayer) => string;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="space-y-2.5" aria-label="Race progress">
      {players.map((player) => {
        const raw = Math.max(0, Math.min(1, progress[player.id] ?? 0));
        const finished = raw >= 0.999;
        return (
          <div key={player.id} className="flex items-center gap-2">
            <div className="relative h-9 flex-1 overflow-hidden rounded-full border border-border bg-surface-2">
              <span className="absolute inset-y-0 left-0 w-full bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(10%-1px),color-mix(in_srgb,var(--ink)_8%,transparent)_calc(10%-1px),color-mix(in_srgb,var(--ink)_8%,transparent)_10%)]" aria-hidden />
              <span className="absolute inset-y-1 right-1 w-1.5 rounded-full bg-[repeating-linear-gradient(45deg,var(--ink)_0,var(--ink)_3px,#fff_3px,#fff_6px)] opacity-30" aria-hidden />
              <motion.span
                className="absolute top-1/2 -translate-y-1/2"
                initial={false}
                animate={{ left: `calc(${raw * 100}% - ${raw * 30}px)` }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18 }}
              >
                <PlayerToken
                  name={player.name}
                  avatarUrl={player.avatarUrl}
                  size="xs"
                  state={finished ? "ready" : player.id === youId ? "turn" : "idle"}
                  teamColor={player.teamColor}
                  showStateBadge={finished}
                />
              </motion.span>
              {finished ? (
                <motion.span
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-success"
                  initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <Icon name="flag" className="h-4 w-4" />
                </motion.span>
              ) : null}
            </div>
            <span className="w-14 shrink-0 truncate text-right text-[11px] font-semibold text-muted">
              {onLaneLabel ? onLaneLabel(player) : player.name.split(" ").slice(-1)[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lives as hearts                                                     */
/* ------------------------------------------------------------------ */

function HeartShape({ filled, className }: { filled: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 20.6C6.6 17 3.6 13.6 3.6 10.2A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 8.4 2.4c0 3.4-3 6.8-8.4 10.4z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0.8 : 1.9}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LivesHearts({
  lives,
  max = 3,
  size = "md",
  label,
  className = "",
}: {
  lives: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const total = Math.max(max, lives);
  const dimension = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="img"
      aria-label={label || `${lives} of ${total} lives left`}
    >
      {Array.from({ length: total }).map((_, index) => {
        const alive = index < lives;
        return (
          <motion.span
            key={index}
            initial={false}
            animate={
              reduced || alive
                ? { scale: 1, opacity: 1 }
                : { scale: [1, 1.35, 0.9], opacity: 0.55 }
            }
            transition={{ duration: 0.35 }}
            className={alive ? "text-danger" : "text-muted/60"}
          >
            <HeartShape filled={alive} className={dimension} />
          </motion.span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tile grid (replaces pill/breadcrumb rows)                           */
/* ------------------------------------------------------------------ */

// Theme-aware tones: each mixes a semantic colour into the active surface, so
// the same class reads correctly in light and dark themes.
const TILE_TONES = [
  "bg-primary-soft text-ink",
  "bg-accent-soft text-ink",
  "bg-[color-mix(in_srgb,var(--info)_18%,var(--surface))] text-ink",
  "bg-[color-mix(in_srgb,var(--primary)_20%,var(--surface))] text-ink",
  "bg-[color-mix(in_srgb,var(--success)_18%,var(--surface))] text-ink",
  "bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface))] text-ink",
];

export function TileGrid({
  items,
  columns = 4,
  onPick,
  selected = [],
  disabled = false,
  tone = "auto",
  size = "md",
  className = "",
}: {
  items: string[];
  columns?: 2 | 3 | 4 | 5;
  onPick?: (value: string) => void;
  selected?: string[];
  disabled?: boolean;
  tone?: "auto" | "uniform";
  size?: "sm" | "md";
  className?: string;
}) {
  const reduced = useReducedMotion();
  const cols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-2 sm:grid-cols-5" }[columns];
  if (!items.length) return null;
  return (
    <div className={`grid gap-2 ${cols} ${className}`}>
      {items.map((item, index) => {
        const active = selected.includes(item);
        const toneClass = tone === "uniform" ? TILE_TONES[0] : TILE_TONES[index % TILE_TONES.length];
        const shared = `flex min-h-11 items-center justify-center rounded-[12px] border px-2 text-center font-semibold ${
          size === "sm" ? "text-xs" : "text-sm"
        } ${active ? "border-ink" : "border-border/70"} ${toneClass}`;
        if (!onPick) {
          return (
            <motion.span
              key={item}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.25 }}
              className={shared}
            >
              {item}
            </motion.span>
          );
        }
        return (
          <motion.button
            key={item}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onPick(item)}
            whileHover={reduced || disabled ? undefined : { y: -2 }}
            whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
            className={`${shared} transition-shadow disabled:opacity-60 ${
              active ? "shadow-[0_3px_0_var(--ink)]" : "shadow-soft"
            }`}
          >
            {item}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Score rail                                                         */
/* ------------------------------------------------------------------ */

function ScoreRow({
  player,
  youId,
  turn,
}: {
  player: HudPlayer;
  youId?: string | null;
  turn: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <li className="relative flex items-center gap-2.5 rounded-[14px] px-2 py-1.5">
      {turn ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-[14px] border border-accent bg-accent/15"
          animate={reduced ? undefined : { opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      ) : null}
      <PlayerToken
        name={player.name}
        avatarUrl={player.avatarUrl}
        size="sm"
        state={turn ? "turn" : "idle"}
        teamColor={player.teamColor}
        showStateBadge={false}
      />
      <span className="relative min-w-0 flex-1 truncate text-xs font-semibold text-ink">
        {player.id === youId ? "You" : player.name}
      </span>
      <motion.span
        key={player.score}
        initial={reduced ? false : { scale: 1.45, color: "var(--success)" }}
        animate={{ scale: 1, color: "var(--ink)" }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className="relative font-mono text-xs font-bold"
      >
        {player.score}
      </motion.span>
    </li>
  );
}

export function ScoreRail({
  players,
  youId,
  turnId,
  className = "",
}: {
  players: HudPlayer[];
  youId?: string | null;
  turnId?: string | null;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const total = players.reduce((sum, player) => sum + player.score, 0);

  return (
    <>
      {/* Desktop: right-hand tab */}
      <aside className={`sticky top-4 hidden lg:block ${className}`}>
        <div className="rounded-[18px] border border-border bg-surface p-3 shadow-soft">
          <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Scores</p>
          <ul className="mt-2 space-y-1">
            {ranked.map((player) => (
              <ScoreRow
                key={player.id}
                player={player}
                youId={youId}
                turn={player.id === turnId}
              />
            ))}
          </ul>
          {players.length ? (
            <p className="mt-2 border-t border-border px-2 pt-2 text-[10px] font-semibold text-muted">
              {players.length} players · {total} pts in play
            </p>
          ) : null}
        </div>
      </aside>

      {/* Mobile: collapsible */}
      <div className="lg:hidden">
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed inset-x-3 bottom-[132px] z-40 rounded-[18px] border border-border bg-surface p-3 shadow-soft min-[901px]:bottom-20"
            >
              <div className="mb-1 flex items-center justify-between px-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Scores</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs font-bold text-muted"
                  aria-label="Hide scores"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {ranked.map((player) => (
                  <ScoreRow
                    key={player.id}
                    player={player}
                    youId={youId}
                    turn={player.id === turnId}
                  />
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Show scores"
          className="fixed bottom-[76px] right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 shadow-soft min-[901px]:bottom-4"
        >
          <span className="flex -space-x-2">
            {ranked.slice(0, 4).map((player) => (
              <PlayerToken
                key={player.id}
                name={player.name}
                avatarUrl={player.avatarUrl}
                size="xs"
                state={player.id === turnId ? "turn" : "idle"}
                showStateBadge={false}
              />
            ))}
          </span>
          {/* Remounts on any score change, so the chip flashes a ring. */}
          <motion.span
            key={total}
            initial={
              reduced
                ? false
                : { boxShadow: "0 0 0 0 rgba(215,244,91,0)" }
            }
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(215,244,91,.9)",
                "0 0 0 10px rgba(215,244,91,0)",
              ],
            }}
            transition={{ duration: 0.9 }}
            className="rounded-full px-1 font-mono text-xs font-bold text-ink"
          >
            {total}
          </motion.span>
        </motion.button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function TeamTag({
  name,
  color,
  className = "",
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-bold ${className}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {name}
    </span>
  );
}

export function HudRow({
  icon,
  children,
  tone = "muted",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "muted" | "danger" | "success";
}) {
  const tones = { muted: "text-muted", danger: "text-danger", success: "text-success" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

export function tileStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index * 20, 300)}ms` };
}
