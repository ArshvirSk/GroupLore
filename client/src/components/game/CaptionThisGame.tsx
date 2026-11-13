"use client";

import { Icon } from "@/components/ui/Icon";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type CaptionChoice = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  votes: number;
  voters: { playerId: string; name: string }[];
};

type CaptionReveal = {
  scenario: string;
  choices: CaptionChoice[];
  roundPoints: { playerId: string; name: string; points: number }[];
};

export type CaptionThisView = {
  phase: "write" | "vote" | "reveal";
  round: number;
  rounds: number;
  mode: string;
  scenario: string;
  submitted: number;
  total: number;
  youSubmitted?: boolean;
  writeMs?: number;
  choices?: { id: string; text: string }[];
  myCaptionId?: string | null;
  myVote?: string | null;
  reveal?: CaptionReveal | null;
};

export default function CaptionThisGame({
  view,
  send,
}: {
  room: RoomView;
  view: CaptionThisView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "write") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Caption this" icon="image">
          {view.scenario}
        </PromptCard>
        <div className="party-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Make it short. Make it unhinged. Make it win.
          </p>
          <AnswerInput
            autoFocus
            maxLength={160}
            placeholder="Your caption…"
            submitLabel="Submit caption"
            disabled={view.youSubmitted}
            onSubmit={(value) => send("caption", { value })}
          />
          <div className="mt-3 flex justify-between text-xs font-bold text-ink-soft">
            <span>
              {view.submitted}/{view.total} captions in
            </span>
            <span>{Math.ceil((view.writeMs || 0) / 1000)}s</span>
          </div>
        </div>
      </div>
    );
  }

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Pick the funniest" icon="trophy" compact>
          {view.scenario}
        </PromptCard>
        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>Vote for a caption</span>
          <span>
            {view.submitted}/{view.total} voted
          </span>
        </div>
        <div className="grid gap-2">
          {(view.choices || []).map((choice) => {
            const mine = view.myCaptionId === choice.id;
            const selected = view.myVote === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={Boolean(view.myVote) || mine}
                onClick={() => send("vote", { choiceId: choice.id })}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left shadow-soft transition ${
                  selected
                    ? "border-grape"
                    : "border-transparent enabled:hover:border-lavender"
                } ${mine ? "opacity-50" : ""} disabled:cursor-default`}
              >
                <span className="flex-1 font-display text-base font-semibold text-ink">
                  {choice.text}
                </span>
                {mine && (
                  <span className="shrink-0 rounded-full bg-ink/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                    yours
                  </span>
                )}
                {selected && <Icon name="check" className="h-5 w-5" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <div className="space-y-4">
      <PromptCard kicker="The winning caption" icon="trophy" compact>
        {reveal.scenario}
      </PromptCard>

      <div className="party-card space-y-3 p-5">
        {reveal.choices.map((choice, index) => (
          <motion.div
            key={choice.id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`rounded-2xl border-2 px-4 py-3 ${
              index === 0 && choice.votes > 0
                ? "border-mint bg-mint/30"
                : "border-transparent bg-cream"
            }`}
          >
            <p className="font-display text-base font-semibold text-ink">
              “{choice.text}”
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-ink-soft">
              <span>{choice.authorName}</span>
              <span>
                {choice.votes} vote{choice.votes === 1 ? "" : "s"}
              </span>
            </div>
            {choice.voters.length > 0 && (
              <p className="mt-1 text-xs font-semibold text-ink-soft">
                {choice.voters.map((voter) => voter.name).join(", ")}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {reveal.roundPoints.length > 0 && (
        <div className="party-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Points this round
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reveal.roundPoints.map((entry) => (
              <span
                key={entry.playerId}
                className="rounded-full bg-honey/50 px-3 py-1 text-sm font-bold text-[#8A5A00]"
              >
                {entry.name} +{entry.points}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
