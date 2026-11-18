"use client";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import { Card as PlayingCardView, Hand as CardHand } from "@/components/cards";
import {
  HudRow,
  LivesHearts,
  PlayerStrip,
  PlayerToken,
  RaceTrack,
  TileGrid,
  type HudPlayer,
} from "@/components/game/GameHud";
import { Badge, Button, Card, Input } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

type Obj = Record<string, unknown>;
type Sender = (type: string, data?: Record<string, unknown>) => void;

export type GameHud = { players: HudPlayer[]; youId: string | null };
type Props = { view: Obj; send: Sender; hud: GameHud };

const asObj = (value: unknown): Obj =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
const asList = (value: unknown): Obj[] => (Array.isArray(value) ? value.map(asObj) : []);
const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const idForName = (hud: GameHud, name: unknown) =>
  hud.players.find((player) => player.name === text(name))?.id || null;

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Card className={`p-5 ${className}`}>{children}</Card>;
}

/* The round already shows in the game header, so this is only the ready count. */
function Status({ view }: { view: Obj }) {
  const submitted = num(view.submitted);
  const total = num(view.total);
  if (!total) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
      <span className="inline-flex items-center gap-1.5">
        <Icon name="check" className="h-3.5 w-3.5" />
        {submitted}/{total} ready
      </span>
    </div>
  );
}

function Points({ view }: { view: Obj; hud?: GameHud }) {
  const reduced = useReducedMotion();
  const points = asList(asObj(view.reveal).roundPoints);
  if (!points.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {points.map((entry, index) => (
        <motion.span
          key={text(entry.playerId)}
          initial={reduced ? false : { opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: index * 0.05 }}
        >
          <Badge tone="success">
            {text(entry.name)} +{num(entry.points)}
          </Badge>
        </motion.span>
      ))}
    </div>
  );
}

/** Player picker as avatar tiles instead of a breadcrumb row. */
function PlayerTiles({
  players,
  onPick,
  disabled = false,
  selected = [],
  columns = 3,
}: {
  players: HudPlayer[];
  onPick: (playerId: string) => void;
  disabled?: boolean;
  selected?: string[];
  columns?: 2 | 3 | 4;
}) {
  const reduced = useReducedMotion();
  const cols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <div className={`grid gap-2 ${cols}`}>
      {players.map((player) => {
        const active = selected.includes(player.id);
        return (
          <motion.button
            key={player.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onPick(player.id)}
            whileHover={reduced || disabled ? undefined : { y: -2 }}
            whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
            className={`flex items-center gap-2 rounded-[14px] border px-3 py-2 text-left transition-colors ${
              active
                ? "border-ink bg-accent-soft shadow-[0_3px_0_var(--ink)]"
                : "border-border bg-surface shadow-soft"
            } disabled:opacity-60`}
          >
            <PlayerToken name={player.name} avatarUrl={player.avatarUrl} size="sm" />
            <span className="min-w-0 truncate text-sm font-semibold text-ink">{player.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function Reorder({
  items,
  prompt,
  submitLabel,
  onSubmit,
  disabled = false,
}: {
  items: string[];
  prompt: string;
  submitLabel: string;
  onSubmit: (order: string[]) => void;
  disabled?: boolean;
}) {
  const [order, setOrder] = useState(items);
  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };
  return (
    <Panel>
      <p className="font-display text-lg font-semibold text-ink">{prompt}</p>
      <div className="mt-3 space-y-2">
        {order.map((item, index) => (
          <motion.div
            key={item}
            layout
            className="flex items-center gap-2 rounded-[14px] border border-border bg-surface px-3 py-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft font-mono text-xs font-bold text-ink">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{item}</span>
            <button
              type="button"
              aria-label={`Move ${item} up`}
              disabled={index === 0}
              className="rounded-lg border border-border px-2 py-1 text-xs font-bold disabled:opacity-40"
              onClick={() => move(index, -1)}
            >
              <Icon name="chevron-down" className="h-3.5 w-3.5 rotate-180" />
            </button>
            <button
              type="button"
              aria-label={`Move ${item} down`}
              disabled={index === order.length - 1}
              className="rounded-lg border border-border px-2 py-1 text-xs font-bold disabled:opacity-40"
              onClick={() => move(index, 1)}
            >
              <Icon name="chevron-down" className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
      <Button className="mt-4 w-full" disabled={disabled} onClick={() => onSubmit(order)}>
        {submitLabel}
      </Button>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Drawing board with tools                                            */
/* ------------------------------------------------------------------ */

const PALETTE = ["#23182f", "#d92d20", "#e8770a", "#3f9b52", "#2f6fd0", "#8b4de0", "#c2185b", "#ffffff"];
const BRUSHES = [2, 4, 8];
type Tool = "pen" | "line" | "rect" | "circle" | "eraser";

const TOOL_GLYPH: Record<Tool, React.ReactNode> = {
  pen: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path d="M4 16l1.2-3.4L13.4 4.4a1.6 1.6 0 012.2 2.2L7.4 14.8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path d="M4 16L16 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  rect: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <rect x="4" y="5" width="12" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" rx="1.5" />
    </svg>
  ),
  circle: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path d="M3 13l7-7 5 5-4 4H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 18h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

function shapePoints(tool: Tool, from: { x: number; y: number }, to: { x: number; y: number }) {
  if (tool === "line") return [from, to];
  if (tool === "rect") {
    return [
      from,
      { x: to.x, y: from.y },
      to,
      { x: from.x, y: to.y },
      from,
    ];
  }
  const radiusX = Math.abs(to.x - from.x) / 2;
  const radiusY = Math.abs(to.y - from.y) / 2;
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2;
  return Array.from({ length: 26 }).map((_, index) => {
    const angle = (index / 25) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * radiusX, y: cy + Math.sin(angle) * radiusY };
  });
}

function DrawingBoard({
  strokes,
  onStroke,
  disabled = false,
  tools = true,
}: {
  strokes: Obj[];
  onStroke?: (stroke: Obj) => void;
  disabled?: boolean;
  tools?: boolean;
}) {
  const [current, setCurrent] = useState<Obj | null>(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(4);
  const [tool, setTool] = useState<Tool>("pen");
  const erasing = tool === "eraser";
  const strokeColor = erasing ? "#ffffff" : color;
  const strokeWidth = erasing ? width * 3 : width;

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };
  const visible = [...strokes, ...(current ? [current] : [])];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      {tools && !disabled ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-2 py-2">
          <div className="flex shrink-0 items-center gap-1.5">
            {PALETTE.slice(0, 7).map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Colour ${swatch}`}
                aria-pressed={!erasing && color === swatch}
                onClick={() => {
                  setColor(swatch);
                  if (erasing) setTool("pen");
                }}
                className={`h-7 w-7 shrink-0 rounded-full border-2 transition-transform ${
                  !erasing && color === swatch ? "scale-110 border-ink" : "border-ink/10"
                }`}
                style={{ background: swatch, minHeight: 0 }}
              />
            ))}
          </div>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <div className="flex shrink-0 items-center gap-1">
            {BRUSHES.map((size) => (
              <button
                key={size}
                type="button"
                aria-label={`Brush size ${size}`}
                aria-pressed={width === size}
                onClick={() => setWidth(size)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                  width === size ? "border-ink bg-surface-2" : "border-border"
                }`}
                style={{ minHeight: 0 }}
              >
                <span
                  className="rounded-full bg-ink"
                  style={{ width: size + 2, height: size + 2 }}
                />
              </button>
            ))}
          </div>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <div className="flex shrink-0 items-center gap-1">
            {(["pen", "line", "rect", "circle", "eraser"] as Tool[]).map((entry) => (
              <button
                key={entry}
                type="button"
                aria-label={entry}
                aria-pressed={tool === entry}
                onClick={() => setTool(entry)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                  tool === entry ? "border-ink bg-accent-soft" : "border-border bg-surface"
                }`}
                style={{ minHeight: 0 }}
              >
                {TOOL_GLYPH[entry]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <svg
        viewBox="0 0 100 75"
        className="h-64 w-full touch-none"
        onPointerDown={(event) => {
          if (disabled) return;
          const p = point(event);
          event.currentTarget.setPointerCapture(event.pointerId);
          setCurrent({ color: strokeColor, width: strokeWidth, points: [p, p] });
        }}
        onPointerMove={(event) => {
          if (disabled || !current) return;
          const p = point(event);
          if (tool === "pen" || erasing) {
            const points = asList(current.points);
            setCurrent({ ...current, points: [...points.slice(0, -1), p] });
          } else {
            const start = asList(current.points)[0] || p;
            setCurrent({ ...current, points: shapePoints(tool, start as { x: number; y: number }, p) });
          }
        }}
        onPointerUp={() => {
          if (disabled || !current) return;
          const points = asList(current.points);
          const finished =
            tool === "pen" || erasing
              ? asList(current.points).slice(0, -1)
              : points;
          if (finished.length > 1) {
            onStroke?.({ ...current, points: finished, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
          }
          setCurrent(null);
        }}
      >
        {visible.map((stroke, index) => (
          <polyline
            key={index}
            points={asList(stroke.points).map((p) => `${num(p.x) * 100},${num(p.y) * 75}`).join(" ")}
            fill="none"
            stroke={text(stroke.color) || "#23182f"}
            strokeWidth={num(stroke.width, 2)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Games                                                               */
/* ------------------------------------------------------------------ */

function ChameleonGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const youId = text(view.youId);
  const others = hud.players.filter((player) => player.id !== (youId || hud.youId));
  const words = asStrings(view.grid);
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip
        players={hud.players}
        youId={hud.youId}
        turnId={phase === "vote" ? (idForName(hud, reveal.chameleonName) ?? null) : null}
      />
      <PromptCard kicker={view.isChameleon ? "You are the chameleon" : "Secret word"} icon="eye" compact>
        <p className="text-sm font-semibold text-muted">Topic: {text(view.topic)}</p>
        <p className="mt-1 font-display text-2xl font-bold">
          {reveal.secret
            ? text(reveal.secret)
            : view.isChameleon
              ? "Blend in. You do not know the word."
              : text(view.secret)}
        </p>
      </PromptCard>
      <Panel>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Word grid</p>
        <TileGrid items={words} columns={4} className="mt-3" size="md" />
      </Panel>
      {phase === "clue" ? (
        <Panel>
          <p className="text-sm font-semibold text-muted">
            Give a one-word clue that proves you know the word without saying it.
          </p>
          {view.hasClued ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-success">
              <Icon name="check" className="h-4 w-4" /> Clue submitted
            </p>
          ) : (
            <div className="mt-3">
              <AnswerInput maxLength={40} placeholder="Your clue…" submitLabel="Send clue" onSubmit={(value) => send("clue", { value })} />
            </div>
          )}
          <AnimatePresence>
            <div className="mt-3 flex flex-wrap gap-2">
              {asList(view.clues).map((entry, index) => (
                <motion.span
                  key={text(entry.playerId)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-[12px] bg-primary-soft px-3 py-1.5 text-sm font-semibold text-ink"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                    {text(entry.name)}
                  </span>{" "}
                  {text(entry.clue)}
                </motion.span>
              ))}
            </div>
          </AnimatePresence>
        </Panel>
      ) : null}
      {phase === "vote" ? (
        view.isChameleon ? (
          <Panel>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
              <Icon name="eye" className="h-4 w-4" /> You don&apos;t vote — watch the room decide.
            </p>
          </Panel>
        ) : (
          <Panel>
            <p className="font-display text-lg font-semibold">Who is the chameleon?</p>
            <div className="mt-3">
              <PlayerTiles
                players={others}
                onPick={(targetId) => send("vote", { targetId })}
                disabled={Boolean(view.hasVoted)}
              />
            </div>
          </Panel>
        )
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <p className="font-display text-xl font-semibold">
            {reveal.caught ? "The chameleon was caught!" : "The chameleon escaped!"}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {text(reveal.chameleonName)} was the chameleon. The word was {text(reveal.secret)}.
          </p>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      ) : null}
    </div>
  );
}

function SpyfallGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const others = hud.players.filter((player) => player.id !== (text(view.youId) || hud.youId));
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip players={hud.players} youId={hud.youId} />
      <PromptCard kicker={view.isSpy ? "You are the spy" : "Your cover"} icon="search" compact>
        <p className="font-display text-2xl font-bold">{view.isSpy ? "Do not reveal yourself" : text(view.location)}</p>
        <p className="mt-1 text-sm font-semibold text-muted">Role: {text(view.role)}</p>
      </PromptCard>
      {view.isSpy && phase !== "reveal" ? (
        <Panel>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Possible locations</p>
          <TileGrid items={asStrings(view.locations)} columns={3} className="mt-3" size="sm" />
        </Panel>
      ) : null}
      {phase === "question" ? (
        <Panel>
          <p className="text-sm font-semibold text-muted">Ask each other questions. When you are ready, call the vote.</p>
          <Button className="mt-3 w-full" onClick={() => send("callVote")}>Call the vote</Button>
        </Panel>
      ) : null}
      {phase === "vote" ? (
        <Panel>
          <p className="font-display text-lg font-semibold">Vote for the spy</p>
          <div className="mt-3">
            <PlayerTiles players={others} onPick={(targetId) => send("vote", { targetId })} disabled={Boolean(view.hasVoted)} />
          </div>
        </Panel>
      ) : null}
      {phase === "spyGuess" ? (
        <Panel>
          <p className="font-display text-lg font-semibold">You were caught. Guess the location to steal it back.</p>
          {view.isSpy ? (
            <div className="mt-3">
              <AnswerInput maxLength={60} placeholder="Location…" submitLabel="Guess location" onSubmit={(value) => send("guess", { value })} />
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-muted">The spy is making a final guess.</p>
          )}
        </Panel>
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <p className="font-display text-xl font-semibold">
            {reveal.caught ? (reveal.correctGuess ? "Caught — but the spy guessed the location!" : "The spy was caught!") : "The spy escaped!"}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {text(reveal.spyName)} was the spy. Location: {text(reveal.location)}.
          </p>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      ) : null}
    </div>
  );
}

function ClosestWinsGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const [value, setValue] = useState("");
  const [wager, setWager] = useState("50");
  const entries = asList(reveal.entries);
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip players={hud.players} youId={hud.youId} readyIds={asStrings(view.readyIds)} />
      <PromptCard kicker="Closest estimate wins" icon="target">{text(view.question)}</PromptCard>
      {phase === "guess" ? (
        <Panel>
          {view.hasGuessed ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
              <Icon name="check" className="h-4 w-4" /> Estimate locked in
            </p>
          ) : (
            <div className="space-y-3">
              <Input label={`Your estimate${view.unit ? ` (${text(view.unit)})` : ""}`} value={value} onChange={(event) => setValue(event.target.value)} />
              {view.wagers ? <Input label="Wager (10–200)" value={wager} onChange={(event) => setWager(event.target.value)} /> : null}
              <Button className="w-full" onClick={() => send("guess", { value, wager })}>Lock in</Button>
            </div>
          )}
        </Panel>
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <p className="font-display text-2xl font-semibold">
            {num(reveal.answer).toLocaleString()} <span className="text-sm font-bold text-muted">{text(reveal.unit)}</span>
          </p>
          <div className="mt-3 space-y-1.5">
            {entries.map((entry) => (
              <div key={text(entry.playerId)} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-2 py-1.5 text-sm">
                <PlayerToken name={text(entry.name)} size="xs" showStateBadge={false} />
                <span className="flex-1 font-semibold">{text(entry.name)}</span>
                <span className="text-muted">{num(entry.value).toLocaleString()}</span>
                <Badge tone={num(entry.distance) <= 0 ? "success" : "neutral"}>off {num(entry.distance).toLocaleString()}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      ) : null}
    </div>
  );
}

function TimelineGame({ view, send }: Props) {
  const reveal = asObj(view.reveal);
  return (
    <div className="space-y-4">
      <Status view={view} />
      {text(view.phase) !== "reveal" ? (
        <Reorder
          key={asStrings(view.items).join("|")}
          items={asStrings(view.items)}
          prompt="Put these events in chronological order, earliest first."
          submitLabel="Submit timeline"
          disabled={Boolean(view.hasOrdered)}
          onSubmit={(order) => send("order", { order })}
        />
      ) : (
        <Panel>
          <p className="font-display text-lg font-semibold">Correct timeline</p>
          <ol className="mt-3 space-y-2">
            {asList(reveal.items).map((item, index) => (
              <li key={text(item.label)} className="flex items-center gap-3 text-sm font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold">{index + 1}</span>
                <span className="flex-1">{text(item.label)}</span>
                <span className="font-bold">{num(item.value)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      )}
    </div>
  );
}

function RankItGame({ view, send }: Props) {
  const reveal = asObj(view.reveal);
  return (
    <div className="space-y-4">
      <Status view={view} />
      {text(view.phase) !== "reveal" ? (
        <Reorder
          key={asStrings(view.items).join("|")}
          items={asStrings(view.items)}
          prompt={`${text(view.prompt)}.`}
          submitLabel="Submit ranking"
          disabled={Boolean(view.hasOrdered)}
          onSubmit={(order) => send("order", { order })}
        />
      ) : (
        <Panel>
          <p className="font-display text-lg font-semibold">{text(reveal.prompt)}</p>
          <ol className="mt-3 space-y-2">
            {asStrings(reveal.order).map((label, index) => (
              <li key={label} className="flex items-center gap-3 text-sm font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft font-mono text-xs font-bold">{index + 1}</span>
                <span className="flex-1">{label}</span>
                <span className="font-bold">{num(asObj(reveal.values)[label]).toLocaleString()}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      )}
    </div>
  );
}

function SpeedTriviaGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const reduced = useReducedMotion();
  const options = asStrings(view.options);
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip players={hud.players} youId={hud.youId} readyIds={asStrings(view.readyIds)} />
      <PromptCard kicker="Speed Trivia" icon="zap">{text(view.question)}</PromptCard>
      {phase === "answer" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option, index) => {
            const picked = view.myAnswer === option;
            return (
              <motion.button
                key={option}
                type="button"
                disabled={Boolean(view.hasAnswered)}
                aria-pressed={picked}
                onClick={() => send("answer", { value: option })}
                whileHover={reduced || view.hasAnswered ? undefined : { y: -2 }}
                whileTap={reduced || view.hasAnswered ? undefined : { scale: 0.98 }}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex min-h-16 items-center gap-3 rounded-[16px] border px-4 text-left font-semibold shadow-soft transition-colors ${
                  picked ? "border-ink bg-accent-soft" : "border-border bg-surface"
                } disabled:opacity-70`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft font-mono text-xs font-bold text-ink">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="text-sm text-ink">{option}</span>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <Panel>
          <p className="font-display text-xl font-semibold">Answer: {text(reveal.answer)}</p>
          <div className="mt-3 space-y-1.5">
            {asList(reveal.rows).map((row) => (
              <div key={text(row.playerId)} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-2 py-1.5 text-sm">
                <PlayerToken name={text(row.name)} size="xs" showStateBadge={false} />
                <span className="flex-1 font-semibold">{text(row.name)}</span>
                <span className={row.correct ? "font-bold text-success" : "text-muted"}>
                  {row.correct ? `+${num(row.points)}` : "missed"}
                </span>
                <Icon name={row.correct ? "check" : "close"} className={`h-4 w-4 ${row.correct ? "text-success" : "text-danger"}`} />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function FlagRushGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip players={hud.players} youId={hud.youId} readyIds={asStrings(view.readyIds)} />
      <Panel className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Which country?</p>
        {/* flag-icons sets `width` outside Tailwind's layers, so the utility
            needs `!` to actually size the flag. */}
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`fi fi-${text(view.code)} mx-auto mt-4 block h-24 w-32! rounded-lg shadow-soft`}
          aria-label="Country flag"
        />
      </Panel>
      {phase === "answer" ? (
        view.hasAnswered ? (
          <p className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-success">
            <Icon name="check" className="h-4 w-4" /> Answer submitted
          </p>
        ) : (
          <Panel>
            <AnswerInput maxLength={60} placeholder="Country name…" submitLabel="Answer" onSubmit={(value) => send("answer", { value })} />
          </Panel>
        )
      ) : (
        <Panel>
          <p className="font-display text-2xl font-semibold">{text(reveal.answer)}</p>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      )}
    </div>
  );
}

function EmojiDecodeGame({ view, send, hud }: Props) {
  const reveal = asObj(view.reveal);
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip players={hud.players} youId={hud.youId} readyIds={asStrings(view.readyIds)} />
      <Panel className="text-center">
        <motion.p
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-5xl leading-relaxed"
        >
          {text(view.emojis)}
        </motion.p>
      </Panel>
      {text(view.phase) === "answer" ? (
        view.hasAnswered ? (
          <p className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-success">
            <Icon name="check" className="h-4 w-4" /> Answer submitted
          </p>
        ) : (
          <Panel>
            <AnswerInput maxLength={80} placeholder="Film, book or character…" submitLabel="Guess" onSubmit={(value) => send("answer", { value })} />
          </Panel>
        )
      ) : (
        <Panel>
          <p className="font-display text-2xl font-semibold">{text(reveal.answer)}</p>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      )}
    </div>
  );
}

function JustOneGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const guesserId = text(view.guesserId) || idForName(hud, view.guesserName);
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip
        players={hud.players}
        youId={hud.youId}
        turnId={guesserId}
        readyIds={asStrings(view.readyIds)}
      />
      <PromptCard kicker={view.isGuesser ? "You are guessing" : "Write one clue"} icon="key" compact>
        <p className="font-display text-2xl font-bold">
          {phase === "clue"
            ? view.isGuesser
              ? text(view.guesserName)
              : text(view.word)
            : phase === "guess"
              ? "Their clues are in"
              : reveal.word
                ? text(reveal.word)
                : "Coordinate silently."}
        </p>
        <p className="mt-1 text-sm font-semibold text-muted">
          {phase === "guess"
            ? view.isGuesser
              ? "Pick the word that fits every clue."
              : `Waiting for ${text(view.guesserName)}.`
            : view.isGuesser
              ? "Your partners are writing clues."
              : "Matching clues will cancel out."}
        </p>
      </PromptCard>
      {phase === "clue" && !view.isGuesser ? (
        <Panel>
          {view.hasClued ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
              <Icon name="check" className="h-4 w-4" /> Clue sent
            </p>
          ) : (
            <AnswerInput maxLength={30} placeholder="One word…" submitLabel="Send clue" onSubmit={(value) => send("clue", { value })} />
          )}
        </Panel>
      ) : null}
      {phase === "guess" ? (
        <Panel>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Clues</p>
          <TileGrid items={asStrings(view.clues)} columns={4} size="sm" className="mt-3" />
          {view.isGuesser ? (
            <div className="mt-3">
              <AnswerInput maxLength={50} placeholder="The word is…" submitLabel="Guess" onSubmit={(value) => send("guess", { value })} />
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-muted">Waiting for {text(view.guesserName)} to guess.</p>
          )}
        </Panel>
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <p className="font-display text-xl font-semibold">{reveal.correct ? "The team got it!" : "Not this time."}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Word: {text(reveal.word)} · Guess: {text(reveal.guess) || "—"}</p>
          {asList(reveal.cancelledClues).length ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
              <Icon name="ban" className="h-3.5 w-3.5" />
              Cancelled: {asList(reveal.cancelledClues).map((entry) => text(entry.clue)).join(", ")}
            </p>
          ) : null}
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      ) : null}
    </div>
  );
}

function SplitOrStealGame({ view, send }: Props) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const reduced = useReducedMotion();
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PromptCard kicker={view.isBye ? "Bye round" : "Your secret partner"} icon={view.isBye ? "eye" : "hand"} compact>
        <p className="font-display text-2xl font-bold">{text(view.partnerName) || "You sit this one out"}</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          {view.isBye ? "Odd player out — watch the other pairs decide." : "Split gives you both 3. Steal gives you 6 if they split."}
        </p>
      </PromptCard>
      {phase === "choose" ? (
        view.isBye ? (
          <Panel className="text-center">
            <Icon name="users" className="mx-auto h-5 w-5 text-muted" />
            <p className="mt-2 text-sm font-semibold text-muted">
              The pairs are choosing now. Your result lands in the reveal.
            </p>
          </Panel>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              type="button"
              disabled={Boolean(view.hasChosen)}
              onClick={() => send("choose", { value: "split" })}
              whileHover={reduced || view.hasChosen ? undefined : { y: -2 }}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[18px] border border-border bg-[color-mix(in_srgb,var(--success)_18%,var(--surface))] font-display text-lg font-bold text-ink shadow-soft disabled:opacity-70"
            >
              <Icon name="users" className="h-6 w-6" />
              Split
            </motion.button>
            <motion.button
              type="button"
              disabled={Boolean(view.hasChosen)}
              onClick={() => send("choose", { value: "steal" })}
              whileHover={reduced || view.hasChosen ? undefined : { y: -2 }}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[18px] border border-border bg-[color-mix(in_srgb,var(--danger)_16%,var(--surface))] font-display text-lg font-bold text-ink shadow-soft disabled:opacity-70"
            >
              <Icon name="hand" className="h-6 w-6" />
              Steal
            </motion.button>
          </div>
        )
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <div className="space-y-3">
            {asList(reveal.pairs).map((pair) => (
              <div key={text(pair.pairId)} className="rounded-xl border border-border bg-surface p-3">
                {asList(pair.players).map((player) => (
                  <div key={text(player.playerId)} className="flex items-center gap-2 text-sm">
                    <PlayerToken name={text(player.name)} size="xs" showStateBadge={false} />
                    <span className="flex-1 font-semibold">{text(player.name)}</span>
                    <Badge tone={text(player.choice) === "steal" ? "danger" : "success"}>{text(player.choice)}</Badge>
                    <span className="font-mono font-bold">+{num(player.points)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      ) : null}
    </div>
  );
}

function AuctionBluffGame({ view, send, hud }: Props) {
  const [bid, setBid] = useState("20");
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const lot = asObj(reveal.lot);
  const winner = asObj(reveal.winner);
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip players={hud.players} youId={hud.youId} readyIds={asStrings(view.readyIds)} />
      <PromptCard kicker={`Mystery lot · bankroll ${num(view.bankroll)}`} icon="megaphone">
        {text(view.hint)}
      </PromptCard>
      {phase === "bid" ? (
        view.hasBid ? (
          <p className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-success">
            <Icon name="check" className="h-4 w-4" /> Bid sealed
          </p>
        ) : (
          <Panel>
            <Input label="Your sealed bid" value={bid} onChange={(event) => setBid(event.target.value)} />
            <Button className="mt-3 w-full" onClick={() => send("bid", { value: bid })}>Place bid</Button>
          </Panel>
        )
      ) : (
        <Panel>
          <p className="font-display text-xl font-semibold">{text(lot.name)}</p>
          <p className="text-sm font-semibold text-muted">True value: {num(lot.value)}</p>
          <p className="mt-2 text-sm font-semibold">
            {winner.name ? `${text(winner.name)} won for ${num(winner.amount)} (profit ${num(winner.profit)})` : "No bids. The lot goes unsold."}
          </p>
          <div className="mt-3 space-y-1">
            {asList(reveal.bids).map((entry) => (
              <div key={text(entry.playerId)} className="flex items-center gap-2 text-sm">
                <PlayerToken name={text(entry.name)} size="xs" showStateBadge={false} />
                <span className="flex-1">{text(entry.name)}</span>
                <span className="font-mono">{num(entry.amount)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3"><Points view={view} /></div>
        </Panel>
      )}
    </div>
  );
}

function BombPartyGame({ view, send, hud }: Props) {
  const currentId = text(view.currentId) || idForName(hud, view.currentName);
  const standings = asList(view.standings);
  const reduced = useReducedMotion();
  return (
    <div className="space-y-4">
      <PlayerStrip players={hud.players} youId={hud.youId} turnId={currentId} />
      <PromptCard kicker={`${text(view.currentName)} is on the clock`} icon="flame" compact>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Your word must contain</p>
        <motion.p
          key={text(view.prompt)}
          initial={reduced ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-display text-4xl font-black tracking-widest"
        >
          {text(view.prompt)}
        </motion.p>
        <LivesHearts lives={num(view.lives)} max={3} className="mt-2" />
      </PromptCard>
      {asStrings(view.usedWords).length ? (
        <Panel>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Already played</p>
          <TileGrid items={asStrings(view.usedWords)} columns={4} size="sm" className="mt-3" />
        </Panel>
      ) : null}
      {text(view.phase) === "play" && view.isMyTurn ? (
        <Panel>
          <AnswerInput maxLength={40} placeholder="Type a word…" submitLabel="Play word" onSubmit={(value) => send("word", { word: value })} />
        </Panel>
      ) : null}
      <Panel>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Lives</p>
        <ul className="mt-2 space-y-1.5">
          {standings.map((player) => (
            <li key={text(player.playerId)} className="flex items-center gap-2">
              <PlayerToken
                name={text(player.name)}
                size="xs"
                state={text(player.playerId) === currentId ? "turn" : num(player.lives) <= 0 ? "out" : "idle"}
                showStateBadge={false}
              />
              <span className="flex-1 truncate text-sm font-semibold">{text(player.name)}</span>
              <LivesHearts lives={num(player.lives)} max={3} size="sm" />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function WordChainGame({ view, send, hud }: Props) {
  const currentId = text(view.currentId) || idForName(hud, view.currentName);
  const reduced = useReducedMotion();
  const chain = asStrings(view.chain);
  return (
    <div className="space-y-4">
      <PlayerStrip players={hud.players} youId={hud.youId} turnId={currentId} />
      <PromptCard kicker={`${text(view.currentName)} is next`} icon="link" compact>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Start with</p>
        <p className="font-display text-3xl font-black">{text(view.requiredLetter).toUpperCase()}</p>
        <p className="mt-1 text-sm font-semibold text-muted">Last word: {text(view.lastWord)}</p>
      </PromptCard>
      {text(view.phase) === "play" && view.isMyTurn ? (
        <Panel>
          <AnswerInput maxLength={40} placeholder="Your word…" submitLabel="Play word" onSubmit={(value) => send("word", { word: value })} />
        </Panel>
      ) : null}
      <Panel>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Chain</p>
          <span className="font-mono text-[11px] font-bold text-muted">
            {num(view.turnsTaken)}/{num(view.turnsTotal)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <AnimatePresence initial={false}>
            {chain.map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                layout
                initial={reduced ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-full px-2.5 py-1 text-sm font-semibold ${
                  index === chain.length - 1 ? "bg-accent text-on-accent" : "bg-surface-2 text-ink"
                }`}
              >
                {word}
              </motion.span>
            ))}
          </AnimatePresence>
          {!chain.length ? <span className="text-sm font-semibold text-muted">No words yet.</span> : null}
        </div>
      </Panel>
    </div>
  );
}

function TypeRaceGame({ view, send, hud }: Props) {
  const [typed, setTyped] = useState("");
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const readyIds = asStrings(view.readyIds);
  const progress: Record<string, number> = {};
  hud.players.forEach((player) => {
    progress[player.id] = readyIds.includes(player.id) ? 1 : 0;
  });
  return (
    <div className="space-y-4">
      <Status view={view} />
      <Panel>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{text(view.title)}</p>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-ink">{text(view.text)}</p>
      </Panel>
      {phase === "race" ? (
        <Panel>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Race</p>
          <div className="mt-2">
            <RaceTrack players={hud.players} progress={progress} youId={hud.youId} />
          </div>
        </Panel>
      ) : null}
      {phase === "race" ? (
        view.hasSubmitted ? (
          <p className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-success">
            <Icon name="check" className="h-4 w-4" /> Submitted at {num(view.myAccuracy)}% accuracy
          </p>
        ) : (
          <Panel>
            <textarea
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="min-h-32 w-full rounded-xl border border-border bg-surface-2 p-3 text-sm font-semibold text-ink outline-none focus:border-primary"
              placeholder="Type the passage here…"
            />
            <Button className="mt-3 w-full" onClick={() => send("text", { value: typed })}>Submit typing</Button>
          </Panel>
        )
      ) : (
        <Panel>
          <div className="space-y-1.5">
            {asList(reveal.rows).map((row) => (
              <div key={text(row.playerId)} className="flex items-center gap-2 text-sm">
                <PlayerToken name={text(row.name)} size="xs" showStateBadge={false} />
                <span className="flex-1 font-semibold">{text(row.name)}</span>
                <span className="font-mono font-bold">{num(row.accuracy)}%</span>
                <Badge tone="success">+{num(row.points)}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

const MARK_CLASS: Record<string, string> = {
  correct: "bg-success text-on-success border-success",
  present: "bg-accent text-on-accent border-accent",
  absent: "bg-surface-2 text-muted border-border",
};

function WordleRaceGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const guesses = asList(view.myGuesses);
  const max = num(view.maxGuesses, 6);
  const reduced = useReducedMotion();
  const progressRows = asList(view.progress);
  const progress: Record<string, number> = {};
  hud.players.forEach((player) => {
    const entry = progressRows.find((row) => text(row.name) === player.name || text(row.playerId) === player.id);
    const count = entry ? num(entry.guesses) : 0;
    progress[player.id] = entry?.solved ? 1 : Math.min(0.95, count / max);
  });
  return (
    <div className="space-y-4">
      <Status view={view} />
      {phase === "play" ? (
        <Panel>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Race</p>
          <div className="mt-2">
            <RaceTrack
              players={hud.players}
              progress={progress}
              youId={hud.youId}
              onLaneLabel={(player) => {
                const entry = progressRows.find((row) => text(row.name) === player.name);
                return entry?.solved ? "solved" : `${entry ? num(entry.guesses) : 0}/${max}`;
              }}
            />
          </div>
        </Panel>
      ) : null}
      <Panel>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Your board</p>
        <div className="mt-2 space-y-1">
          {Array.from({ length: max }).map((_, rowIndex) => {
            const row = guesses[rowIndex];
            const letters = row ? text(row.word).split("") : Array(5).fill("");
            const marks = row ? asStrings(row.marks) : [];
            return (
              <div key={rowIndex} className="flex justify-center gap-1.5">
                {Array.from({ length: 5 }).map((_, column) => (
                  <motion.span
                    key={column}
                    initial={reduced || !marks[column] ? false : { rotateX: 90, opacity: 0.4 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    transition={{ delay: column * 0.06, duration: 0.25 }}
                    className={`flex h-11 w-11 items-center justify-center rounded-[10px] border-2 text-lg font-black uppercase ${
                      marks[column] ? MARK_CLASS[marks[column]] : "border-border bg-surface-2 text-ink"
                    }`}
                  >
                    {letters[column] || ""}
                  </motion.span>
                ))}
              </div>
            );
          })}
        </div>
      </Panel>
      {phase === "play" && !view.solved && guesses.length < max ? (
        <Panel>
          <AnswerInput maxLength={5} placeholder="Five-letter word…" submitLabel="Guess" onSubmit={(value) => send("guess", { word: value })} />
        </Panel>
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <p className="font-display text-2xl font-semibold">Answer: {text(view.answer)}</p>
          <div className="mt-3 space-y-1">
            {asList(reveal.rows).map((row) => (
              <div key={text(row.playerId)} className="flex items-center gap-2 text-sm">
                <PlayerToken name={text(row.name)} size="xs" showStateBadge={false} />
                <span className="flex-1">{text(row.name)}</span>
                <span>{row.solved ? `solved in ${num(row.guesses)}` : "unsolved"}</span>
                {row.solved ? <Badge tone="success">+{num(row.points)}</Badge> : null}
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function HotPotatoGame({ view, send, hud }: Props) {
  const holderId = text(view.holderId) || idForName(hud, view.holderName);
  const standings = asList(view.standings);
  const targets = asList(view.targets).map((entry) => ({
    id: text(entry.playerId),
    name: text(entry.name),
    score: 0,
  }));
  return (
    <div className="space-y-4">
      <PlayerStrip players={hud.players} youId={hud.youId} turnId={holderId} />
      <PromptCard kicker="Hot Potato" icon="flame" compact>
        <p className="font-display text-2xl font-bold">{text(view.holderName)} has the potato</p>
        <LivesHearts lives={num(view.lives)} max={3} className="mt-2" />
      </PromptCard>
      {text(view.phase) === "play" && view.isHolder ? (
        <Panel>
          <p className="text-sm font-semibold text-muted">Pass to:</p>
          <div className="mt-2">
            <PlayerTiles players={targets} onPick={(targetId) => send("pass", { targetId })} columns={3} />
          </div>
        </Panel>
      ) : null}
      <Panel>
        {asObj(view.exploded).name ? (
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-danger">
            <Icon name="flame" className="h-4 w-4" />
            {text(asObj(view.exploded).name)} lost a life
          </p>
        ) : null}
        <ul className="space-y-1.5">
          {standings.map((player) => (
            <li key={text(player.playerId)} className="flex items-center gap-2">
              <PlayerToken
                name={text(player.name)}
                size="xs"
                state={text(player.playerId) === holderId ? "turn" : num(player.lives) <= 0 ? "out" : "idle"}
                showStateBadge={false}
              />
              <span className="flex-1 truncate text-sm font-semibold">{text(player.name)}</span>
              <LivesHearts lives={num(player.lives)} max={3} size="sm" />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function TheMindGame({ view, send, hud }: Props) {
  const mistake = asObj(view.mistake);
  const hand = asStrings(view.myHand);
  const played = asList(view.played);
  const handsLeft = asList(view.handsLeft);
  const reduced = useReducedMotion();
  const cards = hand.map((value, index) => ({ id: `${value}#${index}`, rank: value }));
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip
        players={hud.players}
        youId={hud.youId}
        readyIds={handsLeft.filter((entry) => num(entry.count) === 0).map((entry) => text(entry.playerId))}
      />
      <PromptCard kicker={`Level ${num(view.level)} of ${num(view.levels)}`} icon="brain" compact>
        <div className="flex flex-col items-center gap-1">
          <LivesHearts lives={num(view.lives)} max={Math.max(3, num(view.lives))} size="lg" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">lives</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-muted">Play your cards in ascending order. No talking.</p>
      </PromptCard>
      <Panel>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Your hand</p>
        <div className="mt-3">
          {cards.length ? (
            <CardHand
              cards={cards}
              selectedIds={[]}
              max={1}
              label="Your cards"
              onSelect={(ids) => {
                const picked = ids[0];
                if (!picked) return;
                send("play", { value: picked.split("#")[0] });
              }}
            />
          ) : (
            <p className="text-sm font-semibold text-muted">Your hand is empty.</p>
          )}
        </div>
      </Panel>
      <Panel>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Played</p>
        {played.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {played.map((entry, index) => (
                <motion.span
                  key={`${text(entry.playerId)}-${num(entry.value)}-${index}`}
                  initial={reduced ? false : { opacity: 0, y: -10, rotate: -4 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  className="flex flex-col items-center"
                >
                  <PlayingCardView card={{ id: `played-${index}`, rank: num(entry.value) }} size="sm" />
                  <span className="mt-0.5 max-w-[52px] truncate text-[9px] font-semibold text-muted">
                    {text(entry.name)}
                  </span>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-muted">Nothing yet.</p>
        )}
        {mistake.name ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-danger">
            <Icon name="close" className="h-4 w-4" />
            {text(mistake.name)} played {num(mistake.value)} too low
          </p>
        ) : null}
      </Panel>
      <Panel>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Cards left in hands</p>
        <ul className="mt-2 space-y-1.5">
          {handsLeft.map((entry) => (
            <li key={text(entry.playerId)} className="flex items-center gap-2">
              <PlayerToken
                name={text(entry.name)}
                size="xs"
                state={num(entry.count) === 0 ? "ready" : "idle"}
                showStateBadge={false}
              />
              <span className="flex-1 truncate text-sm font-semibold">{text(entry.name)}</span>
              <span className="flex gap-1" aria-label={`${num(entry.count)} cards`}>
                {Array.from({ length: Math.min(8, Math.max(0, num(entry.count))) }).map((_, index) => (
                  <span
                    key={index}
                    className="h-5 w-3.5 rounded-[3px] border border-ink/25 bg-[linear-gradient(135deg,var(--primary-soft),var(--surface))] shadow-sm"
                    aria-hidden
                  />
                ))}
                {num(entry.count) > 8 ? (
                  <span className="text-xs font-bold text-muted">×{num(entry.count)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function DrawRoundGame({ view, send, hud, telephone = false, bad = false }: Props & { telephone?: boolean; bad?: boolean }) {
  const phase = text(view.phase);
  const reveal = asObj(view.reveal);
  const isArtist = Boolean(view.isArtist || view.isDrawer);
  const artistName = text(view.artistName || view.drawerName);
  return (
    <div className="space-y-4">
      <Status view={view} />
      <PlayerStrip
        players={hud.players}
        youId={hud.youId}
        turnId={isArtist ? hud.youId : idForName(hud, artistName)}
        readyIds={asStrings(view.doneIds)}
      />
      {phase === "choose" ? (
        <Panel>
          <p className="font-display text-lg font-semibold">Pick a word to draw</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {asList(view.choices).map((choice, index) => (
              <motion.button
                key={text(choice.id)}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => send("chooseWord", { wordId: text(choice.id) })}
                className="min-h-16 rounded-[16px] border border-border bg-surface px-4 font-display text-lg font-semibold text-ink shadow-soft transition-transform hover:-translate-y-0.5"
              >
                {text(choice.text)}
              </motion.button>
            ))}
          </div>
        </Panel>
      ) : null}
      {phase === "draw" || phase === "play" ? (
        <>
          <PromptCard kicker={telephone ? `Your prompt · ${text(view.doneCount)}/${text(view.total)} finished` : isArtist ? "You are the artist" : `${artistName} is drawing`} icon="image" compact>
            <p className="font-display text-2xl font-bold">
              {telephone ? text(view.myPrompt) : isArtist ? text(view.prompt || view.word) || "Drawing…" : "Guess the drawing."}
            </p>
            {!telephone && !isArtist ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
                <Icon name="check" className="h-4 w-4" />
                {asStrings(view.correctNames).length ? asStrings(view.correctNames).join(", ") : "no correct guesses yet"}
              </p>
            ) : null}
          </PromptCard>
          {telephone ? (
            <>
              <DrawingBoard strokes={asList(view.myStrokes)} disabled={Boolean(view.drawingDone)} onStroke={(stroke) => send("stroke", { stroke })} />
              {!view.drawingDone ? (
                <Button className="w-full" onClick={() => send("done")}>Finish drawing</Button>
              ) : (
                <p className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-success">
                  <Icon name="check" className="h-4 w-4" /> Drawing locked in
                </p>
              )}
            </>
          ) : (
            <>
              {isArtist ? (
                <DrawingBoard strokes={asList(view.strokes)} onStroke={(stroke) => send("stroke", { stroke })} />
              ) : (
                <DrawingBoard strokes={asList(view.strokes)} disabled />
              )}
              {!isArtist ? (
                <Panel>
                  <AnswerInput maxLength={80} placeholder="Your guess…" submitLabel="Guess" onSubmit={(value) => send("guess", { value })} />
                  {asStrings(view.myGuesses).length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {asStrings(view.myGuesses).slice(-4).map((guess) => (
                        <Badge key={guess}>{guess}</Badge>
                      ))}
                    </div>
                  ) : null}
                </Panel>
              ) : (
                <p className="text-center text-sm font-semibold text-muted">Keep drawing. The room is guessing.</p>
              )}
            </>
          )}
        </>
      ) : null}
      {phase === "guess" && telephone ? (
        <Panel>
          <p className="font-display text-lg font-semibold">What is {text(view.sourceName)} drawing?</p>
          <div className="mt-3"><DrawingBoard strokes={asList(view.sourceStrokes)} disabled tools={false} /></div>
          <div className="mt-3">
            <AnswerInput maxLength={80} placeholder="Your interpretation…" submitLabel="Send guess" onSubmit={(value) => send("guess", { value })} />
          </div>
        </Panel>
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          {telephone ? (
            <div className="space-y-4">
              {asList(reveal.rows).map((row) => (
                <div key={text(row.playerId)} className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{text(row.artistName)} drew</p>
                  <p className="font-display text-lg font-semibold">{text(row.prompt)}</p>
                  <div className="mt-2"><DrawingBoard strokes={asList(row.strokes)} disabled tools={false} /></div>
                  <p className="mt-2 text-sm font-semibold">Then {text(row.name)} guessed: <strong>{text(row.guess)}</strong></p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="font-display text-2xl font-semibold">{bad ? text(reveal.prompt) : text(reveal.word)}</p>
              <p className="mt-1 text-sm font-semibold text-muted">
                {text(reveal.reason) === "timeout" ? "Nobody got it in time." : `Solved by ${asStrings(reveal.correctNames).join(", ")}`}
              </p>
              <div className="mt-3"><DrawingBoard strokes={asList(reveal.strokes)} disabled tools={false} /></div>
              <div className="mt-3"><Points view={view} /></div>
            </>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

// Role chips mix into the active surface so they stay readable in both themes.
const ROLE_TONE: Record<string, string> = {
  werewolf: "bg-[color-mix(in_srgb,var(--danger)_18%,var(--surface))] text-ink",
  spy: "bg-[color-mix(in_srgb,var(--danger)_18%,var(--surface))] text-ink",
  seer: "bg-[color-mix(in_srgb,var(--primary)_22%,var(--surface))] text-ink",
  doctor: "bg-[color-mix(in_srgb,var(--success)_18%,var(--surface))] text-ink",
  villager: "bg-[color-mix(in_srgb,var(--info)_18%,var(--surface))] text-ink",
  resistance: "bg-[color-mix(in_srgb,var(--info)_18%,var(--surface))] text-ink",
};

function WerewolfGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const lastNight = asObj(view.lastNight);
  const voteResult = asObj(view.voteResult);
  const role = text(view.role);
  const youId = text(view.youId) || hud.youId || "";
  // `aliveIds` is the authoritative list; fall back to everyone before it lands.
  const aliveIds = asStrings(view.aliveIds);
  const livingIds = aliveIds.length ? aliveIds : hud.players.map((player) => player.id);
  const aliveCount = aliveIds.length || hud.players.length;
  const outIds = hud.players.filter((player) => !livingIds.includes(player.id)).map((player) => player.id);
  const targets = hud.players.filter((player) => livingIds.includes(player.id) && player.id !== youId);
  const pack = asList(view.teammates).filter((entry) => text(entry.playerId) !== youId);
  return (
    <div className="space-y-4">
      <PlayerStrip players={hud.players} youId={hud.youId} outIds={outIds} />
      <PromptCard kicker={`Day ${num(view.day)} · ${phase}`} icon="moon" compact>
        <p className="font-display text-xl font-bold">
          Your role:{" "}
          <span className={`rounded-full px-2 py-0.5 ${ROLE_TONE[role] || "bg-surface-2"}`}>{role}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <HudRow icon={<Icon name="users" className="h-3.5 w-3.5" />}>
            {aliveCount} alive
          </HudRow>
          {!view.alive ? (
            <HudRow icon={<Icon name="close" className="h-3.5 w-3.5" />} tone="danger">
              You are dead
            </HudRow>
          ) : null}
        </div>
        {pack.length ? (
          <p className="mt-1 text-sm font-semibold text-danger">
            Pack: {pack.map((entry) => text(entry.name)).join(", ")}
          </p>
        ) : null}
      </PromptCard>
      {phase === "night" && view.alive ? (
        <Panel>
          <p className="text-sm font-semibold text-muted">
            {role === "werewolf" ? "Choose a villager to kill." : role === "seer" ? "Inspect a player's role." : role === "doctor" ? "Protect one player from the wolves." : "The village sleeps."}
          </p>
          {["werewolf", "seer", "doctor"].includes(role) ? (
            view.nightChoice ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-success">
                <Icon name="check" className="h-4 w-4" /> Choice locked in
              </p>
            ) : (
              <div className="mt-3">
                <PlayerTiles
                  players={targets}
                  columns={3}
                  onPick={(targetId) => send(role === "werewolf" ? "kill" : role === "seer" ? "inspect" : "protect", { targetId })}
                />
              </div>
            )
          ) : null}
        </Panel>
      ) : null}
      {role === "seer" && asList(view.inspections).length ? (
        <Panel>
          <ul className="space-y-1.5">
            {asList(view.inspections).map((entry) => (
              <li key={text(entry.targetId)} className="flex items-center gap-2 text-sm">
                <PlayerToken name={text(entry.name)} size="xs" showStateBadge={false} />
                <span className="flex-1 font-semibold">{text(entry.name)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ROLE_TONE[text(entry.role)] || "bg-surface-2"}`}>
                  {text(entry.role)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {phase === "day" ? (
        <Panel>
          {lastNight.diedName ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-danger">
              <Icon name="moon" className="h-4 w-4" /> {text(lastNight.diedName)} was killed in the night
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
              <Icon name="shield" className="h-4 w-4" /> Nobody died last night
            </p>
          )}
          <p className="mt-2 text-sm font-semibold text-muted">Discuss. A vote starts when the timer ends.</p>
        </Panel>
      ) : null}
      {phase === "vote" && view.alive ? (
        <Panel>
          <p className="font-display text-lg font-semibold">Who should be eliminated?</p>
          {view.hasVoted ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-success">
              <Icon name="check" className="h-4 w-4" /> Vote locked
            </p>
          ) : (
            <div className="mt-3">
              <PlayerTiles players={targets} columns={3} onPick={(targetId) => send("vote", { targetId })} />
            </div>
          )}
        </Panel>
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <p className="font-display text-lg font-semibold">
            {voteResult.tie ? "The vote tied. Nobody was eliminated." : `${text(voteResult.eliminatedName)} was eliminated.`}
          </p>
          {voteResult.eliminatedName ? (
            <p className="mt-1 text-sm font-semibold text-muted">They were a {text(voteResult.eliminatedRole)}.</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {asList(voteResult.votes).map((entry, index) => (
              <Badge key={index}>
                {text(entry.name)} → {text(entry.targetName)}
              </Badge>
            ))}
          </div>
        </Panel>
      ) : null}
      {phase === "results" ? (
        <Panel>
          <p className="font-display text-2xl font-semibold">{text(view.winner) === "werewolf" ? "The wolves win." : "The village wins."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {asList(view.allRoles).map((entry) => (
              <span
                key={text(entry.playerId)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  ROLE_TONE[text(entry.role)] || "bg-surface-2"
                }`}
              >
                <PlayerToken name={text(entry.name)} size="xs" showStateBadge={false} />
                {text(entry.name)} · {text(entry.role)}
              </span>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function ResistanceGame({ view, send, hud }: Props) {
  const phase = text(view.phase);
  const [team, setTeam] = useState<string[]>([]);
  const spies = asList(view.spyTeam);
  const squadIds = asList(view.squad).map((entry) => text(entry.playerId));
  const players = hud.players;
  const results = asStrings(view.missionResults);
  const toggle = (playerId: string) => {
    setTeam((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      if (current.length >= num(view.required)) return current;
      return [...current, playerId];
    });
  };
  const role = text(view.role);
  return (
    <div className="space-y-4">
      <PlayerStrip
        players={hud.players}
        youId={hud.youId}
        turnId={text(view.leaderId) || idForName(hud, view.leaderName)}
        readyIds={squadIds}
      />
      <PromptCard kicker={`Mission ${num(view.mission)} of ${num(view.missions)}`} icon="shield" compact>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-xl font-bold">
            Your role:{" "}
            <span className={`rounded-full px-2 py-0.5 ${ROLE_TONE[role] || "bg-surface-2"}`}>{role}</span>
          </p>
          <HudRow icon={<Icon name="close" className="h-3.5 w-3.5" />} tone={num(view.rejectCount) >= 4 ? "danger" : "muted"}>
            {num(view.rejectCount)}/5 rejects
          </HudRow>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {Array.from({ length: num(view.missions, 5) }).map((_, index) => {
            const result = results[index];
            return (
              <span
                key={index}
                className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                  result === "true"
                    ? "border-success bg-success/15 text-success"
                    : result === "false"
                      ? "border-danger bg-danger/15 text-danger"
                      : "border-border bg-surface-2 text-muted"
                }`}
                title={result ? (result === "true" ? "Success" : "Fail") : "Unresolved"}
              >
                <Icon name={result === "false" ? "close" : result === "true" ? "check" : "shield"} className="h-3.5 w-3.5" />
              </span>
            );
          })}
        </div>
        {spies.length ? (
          <p className="mt-2 text-sm font-semibold text-danger">Spies: {spies.map((entry) => text(entry.name)).join(", ")}</p>
        ) : null}
      </PromptCard>
      {phase === "team" ? (
        <Panel>
          <p className="font-display text-lg font-semibold">
            {text(view.leaderName)} is choosing {num(view.required)} players
          </p>
          {view.isLeader ? (
            <>
              <div className="mt-3">
                <PlayerTiles players={players} selected={team} onPick={toggle} columns={3} />
              </div>
              <Button className="mt-3 w-full" disabled={team.length !== num(view.required)} onClick={() => send("team", { playerIds: team })}>
                Send team ({team.length}/{num(view.required)})
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-muted">Waiting for the leader.</p>
          )}
        </Panel>
      ) : null}
      {phase === "vote" ? (
        <Panel>
          <p className="font-display text-lg font-semibold">Approve this team?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {asList(view.squad).map((player) => (
              <span key={text(player.playerId)} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold">
                <PlayerToken name={text(player.name)} size="xs" showStateBadge={false} />
                {text(player.name)}
              </span>
            ))}
          </div>
          {view.hasVoted ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-success">
              <Icon name="check" className="h-4 w-4" /> Vote locked
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => send("vote", { value: "approve" })}>Approve</Button>
              <Button variant="secondary" onClick={() => send("vote", { value: "reject" })}>Reject</Button>
            </div>
          )}
        </Panel>
      ) : null}
      {phase === "mission" ? (
        <Panel>
          <p className="font-display text-lg font-semibold">Mission in progress</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {asList(view.squad).map((player) => (
              <span key={text(player.playerId)} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold">
                <PlayerToken name={text(player.name)} size="xs" showStateBadge={false} />
                {text(player.name)}
              </span>
            ))}
          </div>
          {view.isOnTeam ? (
            view.hasActed ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-success">
                <Icon name="check" className="h-4 w-4" /> Choice locked
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => send("mission", { value: "success" })}>Success</Button>
                <Button variant="secondary" disabled={!view.isSpy} onClick={() => send("mission", { value: "fail" })}>Sabotage</Button>
              </div>
            )
          ) : (
            <p className="mt-2 text-sm font-semibold text-muted">Waiting for the team.</p>
          )}
        </Panel>
      ) : null}
      {phase === "reveal" ? (
        <Panel>
          <p className="font-display text-xl font-semibold">
            {asObj(view.lastMission).success ? "Mission succeeded." : `Mission failed with ${num(asObj(view.lastMission).fails)} sabotage.`}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">
            {asObj(asObj(view.lastMission).vote).approved ? "The team was approved." : "The team was rejected."}
          </p>
        </Panel>
      ) : null}
      {phase === "results" ? (
        <Panel>
          <p className="font-display text-2xl font-semibold">{text(view.winner) === "spy" ? "The spies win." : "The resistance wins."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {asList(view.allRoles).map((entry) => (
              <span
                key={text(entry.playerId)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  ROLE_TONE[text(entry.role)] || "bg-surface-2"
                }`}
              >
                <PlayerToken name={text(entry.name)} size="xs" showStateBadge={false} />
                {text(entry.name)} · {text(entry.role)}
              </span>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

const RENDERERS: Record<string, React.ComponentType<Props>> = {
  chameleon: ChameleonGame,
  spyfall: SpyfallGame,
  "closest-wins": ClosestWinsGame,
  timeline: TimelineGame,
  "rank-it": RankItGame,
  "speed-trivia": SpeedTriviaGame,
  "flag-rush": FlagRushGame,
  "emoji-decode": EmojiDecodeGame,
  "just-one": JustOneGame,
  "split-or-steal": SplitOrStealGame,
  "auction-bluff": AuctionBluffGame,
  "bomb-party": BombPartyGame,
  "word-chain": WordChainGame,
  "type-race": TypeRaceGame,
  "wordle-race": WordleRaceGame,
  "hot-potato": HotPotatoGame,
  "the-mind": TheMindGame,
  "draw-guess": (props) => <DrawRoundGame {...props} />,
  "bad-artist": (props) => <DrawRoundGame {...props} bad />,
  "draw-telephone": (props) => <DrawRoundGame {...props} telephone />,
  werewolf: WerewolfGame,
  resistance: ResistanceGame,
};

export const MODES_GAME_IDS = Object.keys(RENDERERS);

export default function ModesGame({
  room,
  view,
  send,
}: {
  room: {
    gameId?: string | null;
    players?: {
      id: string;
      name: string;
      score: number;
      avatarUrl?: string | null;
      connected?: boolean;
    }[];
    you?: { id: string } | null;
  };
  view: Obj;
  send: Sender;
}) {
  const Renderer = room.gameId ? RENDERERS[room.gameId] : null;
  if (!Renderer) return null;
  const hud: GameHud = {
    players: (room.players || []).map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      avatarUrl: player.avatarUrl,
      connected: player.connected,
    })),
    youId: room.you?.id || null,
  };
  return <Renderer view={view} send={send} hud={hud} />;
}
