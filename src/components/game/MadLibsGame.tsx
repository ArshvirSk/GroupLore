"use client";

import { Icon } from "@/components/ui/Icon";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type StorySegment = {
  type: "text" | "blank";
  text?: string;
  id?: string;
  value?: string;
  isMine?: boolean;
  name?: string;
};

type MyBlank = {
  id: string;
  type: string;
  hint: string;
  value: string;
  submitted: boolean;
};

export type MadLibsView =
  | {
      phase: "fill";
      round: number;
      rounds: number;
      title: string;
      blanks: MyBlank[];
      submitted: number;
      total: number;
      fillMs: number;
    }
  | {
      phase: "read";
      round: number;
      rounds: number;
      title: string;
      segments: StorySegment[];
    }
  | {
      phase: "rate";
      round: number;
      rounds: number;
      title: string;
      segments: StorySegment[];
      targets: { id: string; value: string }[];
      myRatings: Record<string, number>;
      rated: number;
      total: number;
    }
  | {
      phase: "reveal";
      round: number;
      rounds: number;
      reveal: {
        title: string;
        segments: StorySegment[];
        blanks: {
          id: string;
          value: string;
          playerId: string;
          name: string;
          average: number;
        }[];
        roundPoints: { playerId: string; name: string; points: number }[];
      };
    };

function Story({ segments }: { segments: StorySegment[] }) {
  return (
    <p className="font-display text-lg font-semibold leading-relaxed text-ink">
      {segments.map((segment, index) =>
        segment.type === "blank" ? (
          <span
            key={`${segment.id}-${index}`}
            className="mx-0.5 rounded-md bg-honey/70 px-1.5 py-0.5 text-[#7A4B00]"
            title={segment.name ? `Filled by ${segment.name}` : undefined}
          >
            {segment.value}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}

export default function MadLibsGame({
  view,
  send,
}: {
  room: RoomView;
  view: MadLibsView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "fill") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Blind story fill" icon="book">
          {view.title}
          <span className="mt-2 block text-sm text-ink-soft">
            Fill your blanks without seeing the story. Chaos comes later.
          </span>
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Your blanks</span>
          <span>{view.submitted}/{view.total} filled</span>
        </div>

        {view.blanks.map((blank) => (
          <div key={blank.id} className="party-card space-y-3 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                {blank.type}
              </p>
              <p className="font-display text-lg font-semibold text-ink">{blank.hint}</p>
            </div>
            {blank.submitted ? (
              <p className="text-sm font-bold text-[#0F7F6C]">“{blank.value}” locked in <Icon name="check" className="inline h-4 w-4" /></p>
            ) : (
              <AnswerInput
                maxLength={40}
                placeholder="Your word…"
                submitLabel="Lock word"
                onSubmit={(value) => send("fill", { blankId: blank.id, value })}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  if (view.phase === "read") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Your ridiculous story" icon="book" compact>
          {view.title}
        </PromptCard>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="party-card p-6"
        >
          <Story segments={view.segments} />
        </motion.div>
        <p className="text-center text-sm font-bold text-ink-soft">
          Rating opens next. Try not to laugh.
        </p>
      </div>
    );
  }

  if (view.phase === "rate") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Rate the blanks" icon="star" compact>
          {view.title}
        </PromptCard>
        <div className="party-card p-5">
          <Story segments={view.segments} />
        </div>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Rate everyone else&apos;s words</span>
          <span>{view.rated}/{view.total} rated</span>
        </div>

        {view.targets.map((target) => {
          const selected = view.myRatings[target.id];
          return (
            <div key={target.id} className="party-card p-4">
              <p className="font-display text-base font-semibold text-ink">{target.value}</p>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    disabled={Boolean(selected)}
                    onClick={() => send("rate", { blankId: target.id, value: rating })}
                    className={`min-h-10 rounded-xl border-2 text-sm font-bold transition ${
                      selected === rating
                        ? "border-grape bg-grape text-white"
                        : "border-transparent bg-cream text-ink enabled:hover:border-lavender"
                    } disabled:cursor-default`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {view.rated === view.total && (
          <p className="text-center text-sm font-bold text-ink-soft">Ratings locked. Results coming…</p>
        )}
      </div>
    );
  }

  const reveal = view.reveal;
  return (
    <div className="space-y-4">
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card bg-honey/30 p-6"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          Round {view.round} story
        </p>
        <p className="mt-1 font-display text-xl font-semibold text-ink">{reveal.title}</p>
        <div className="mt-3">
          <Story segments={reveal.segments} />
        </div>
      </motion.div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Blank ratings</p>
        <div className="mt-2 grid gap-2">
          {reveal.blanks.map((blank) => (
            <div
              key={blank.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2"
            >
              <p className="text-sm font-semibold text-ink">
                <span className="font-bold">{blank.value}</span> · {blank.name}
              </p>
              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold text-ink-soft">
                {blank.average}/5
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Points this round</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reveal.roundPoints.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">Nobody scored.</p>
          ) : (
            reveal.roundPoints.map((entry) => (
              <span
                key={entry.playerId}
                className="rounded-full bg-blush/60 px-3 py-1 text-sm font-bold text-[#B83232]"
              >
                {entry.name} +{entry.points}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
