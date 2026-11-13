"use client";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";

type HiveGroup = {
  id: string;
  answer: string;
  playerIds: string[];
  names: string[];
  points: number;
};

export type HiveMindView = {
  phase: "answer" | "reveal";
  round: number;
  rounds: number;
  prompt: string;
  submitted: number;
  total: number;
  youSubmitted: boolean;
  answerMs: number;
  yourAnswer?: string | null;
  groups?: HiveGroup[];
  roundPoints?: { playerId: string; name: string; points: number }[];
};

export default function HiveMindGame({
  view,
  send,
}: {
  room: RoomView;
  view: HiveMindView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "answer") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Everyone answers the same prompt" icon="heart">
          {view.prompt}
        </PromptCard>

        <div className="party-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Think like the group, not like yourself
          </p>
          <AnswerInput
            autoFocus
            maxLength={80}
            placeholder="Your answer…"
            submitLabel="Send it"
            disabled={view.youSubmitted}
            onSubmit={(value) => send("answer", { value })}
          />
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-ink-soft">
            <span>
              {view.submitted}/{view.total} answers in
            </span>
            <span>{Math.ceil(view.answerMs / 1000)}s</span>
          </div>
        </div>

        {view.youSubmitted && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Locked in. Hoping the hive agrees…
          </p>
        )}
      </div>
    );
  }

  const groups = view.groups || [];
  const maxPoints = Math.max(1, ...groups.map((group) => group.points));

  return (
    <div className="space-y-4">
      <PromptCard kicker="The group answered" icon="star" compact>
        {view.prompt}
      </PromptCard>

      <div className="party-card space-y-3 p-5">
        {groups.map((group, index) => (
          <motion.div
            key={group.id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`rounded-2xl border-2 px-4 py-3 ${
              group.points > 0
                ? "border-mint bg-mint/30"
                : "border-transparent bg-cream"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-lg font-semibold text-ink">
                {group.answer}
              </p>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                  group.points > 0
                    ? "bg-mint text-[#0F7F6C]"
                    : "bg-ink/5 text-ink-soft"
                }`}
              >
                {group.points > 0 ? `+${group.points}` : "alone"}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-ink-soft">
              {group.names.join(", ")}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/5">
              <div
                className="h-full rounded-full bg-honey"
                style={{
                  width: `${Math.max(6, Math.round((group.points / maxPoints) * 100))}%`,
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {view.yourAnswer && (
        <p className="text-center text-sm font-bold text-ink-soft">
          You said “{view.yourAnswer}”
        </p>
      )}

      {view.roundPoints && view.roundPoints.length > 0 && (
        <div className="party-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Round points
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {view.roundPoints.map((entry) => (
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
