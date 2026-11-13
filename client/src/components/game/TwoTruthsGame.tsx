"use client";

import { Icon } from "@/components/ui/Icon";

import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

type TruthStatement = { id: string; text: string };

export type TwoTruthsView =
  | {
      phase: "write";
      round: number;
      rounds: number;
      hint: string;
      submitted: number;
      total: number;
      youSubmitted: boolean;
      writeMs: number;
    }
  | {
      phase: "vote";
      round: number;
      rounds: number;
      subjectName: string;
      statements: TruthStatement[];
      isSubject: boolean;
      canVote: boolean;
      myVote: string | null;
      submitted: number;
      total: number;
    }
  | {
      phase: "reveal";
      round: number;
      rounds: number;
      reveal: {
        subjectName: string;
        hint: string;
        statements: { id: string; text: string; isLie: boolean; votes: number }[];
        correctGuessers: { playerId: string; name: string }[];
        fooled: { playerId: string; name: string }[];
        roundPoints: { playerId: string; name: string; points: number }[];
      };
    };

function WriteSet({ view, send }: { view: Extract<TwoTruthsView, { phase: "write" }>; send: (type: string, data?: Record<string, unknown>) => void }) {
  const [statements, setStatements] = useState(["", "", ""]);
  const [lieIndex, setLieIndex] = useState<number | null>(null);
  const ready = statements.every((text) => text.trim()) && lieIndex !== null;

  function update(index: number, value: string) {
    setStatements((current) => current.map((text, item) => (item === index ? value : text)));
  }

  return (
    <div className="space-y-4">
      <PromptCard kicker="Two truths, one lie" icon="mask">
        {view.hint || "Tell the room something surprising."}
        <span className="mt-2 block text-sm text-ink-soft">
          Two statements must be true. One must be a lie.
        </span>
      </PromptCard>

      {view.youSubmitted ? (
        <div className="party-card p-6 text-center">
          <Icon name="key" className="mx-auto h-8 w-8" />
          <p className="mt-2 font-display text-lg font-semibold text-ink">Your set is locked in</p>
          <p className="mt-1 text-sm font-bold text-ink-soft">
            {view.submitted}/{view.total} players ready
          </p>
        </div>
      ) : (
        <div className="party-card space-y-3 p-5">
          {statements.map((statement, index) => (
            <div key={index} className="rounded-2xl bg-cream p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Statement {index + 1}
                </span>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-soft">
                  <input
                    type="radio"
                    name="lie"
                    checked={lieIndex === index}
                    onChange={() => setLieIndex(index)}
                    className="accent-grape"
                  />
                  This is the lie
                </label>
              </div>
              <input
                value={statement}
                onChange={(event) => update(index, event.target.value)}
                maxLength={100}
                placeholder={index === 0 ? "A truth about you…" : "Another statement…"}
                className="mt-2 min-h-11 w-full rounded-xl border-2 border-transparent bg-white px-3 text-base font-semibold text-ink shadow-soft outline-none transition placeholder:text-ink-soft/60 focus:border-grape"
              />
            </div>
          ))}
          <button
            type="button"
            disabled={!ready}
            onClick={() => send("submit", { statements, lieIndex })}
            className="min-h-12 w-full rounded-2xl bg-grape px-6 font-display text-sm font-semibold text-white shadow-soft transition enabled:hover:bg-[#7C4DEB] disabled:opacity-40"
          >
            Lock my three statements
          </button>
          <p className="text-center text-xs font-bold text-ink-soft">
            {Math.ceil(view.writeMs / 1000)}s · {view.submitted}/{view.total} submitted
          </p>
        </div>
      )}
    </div>
  );
}

export default function TwoTruthsGame({
  view,
  send,
}: {
  room: RoomView;
  view: TwoTruthsView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();

  if (view.phase === "write") return <WriteSet view={view} send={send} />;

  if (view.phase === "vote") {
    return (
      <div className="space-y-4">
        <PromptCard kicker={`${view.subjectName}'s statements`} icon="search" compact>
          Which one is the lie?
        </PromptCard>

        <div className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <span>{view.isSubject ? "Your set is under inspection" : "Pick the lie"}</span>
          <span>{view.submitted}/{view.total} voted</span>
        </div>

        <div className="grid gap-2">
          {view.statements.map((statement, index) => {
            const selected = view.myVote === statement.id;
            return (
              <button
                key={statement.id}
                type="button"
                disabled={!view.canVote || Boolean(view.myVote)}
                onClick={() => send("vote", { statementId: statement.id })}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left shadow-soft transition ${
                  selected ? "border-grape bg-lavender/30" : "border-transparent enabled:hover:border-lavender"
                } disabled:cursor-default`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-bold text-ink-soft">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1 font-display text-base font-semibold text-ink">
                  {statement.text}
                </span>
                {selected && <Icon name="check" className="h-5 w-5" />}
              </button>
            );
          })}
        </div>

        {view.isSubject && (
          <p className="text-center text-sm font-bold text-ink-soft">
            Sit tight. The room is deciding which one you made up.
          </p>
        )}
        {view.myVote && (
          <p className="text-center text-sm font-bold text-ink-soft">Vote locked. Reveal coming…</p>
        )}
      </div>
    );
  }

  const reveal = view.reveal;
  const lie = reveal.statements.find((statement) => statement.isLie);
  return (
    <div className="space-y-4">
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card bg-mint/40 p-6 text-center"
      >
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          {reveal.subjectName}&apos;s lie
        </p>
        <p className="mt-2 font-display text-2xl font-semibold text-ink">{lie?.text}</p>
        <p className="mt-2 text-sm font-bold text-ink-soft">{reveal.hint}</p>
      </motion.div>

      <div className="party-card space-y-3 p-5">
        {reveal.statements.map((statement) => (
          <div
            key={statement.id}
            className={`rounded-2xl border-2 px-4 py-3 ${
              statement.isLie ? "border-coral bg-blush/30" : "border-transparent bg-cream"
            }`}
          >
            <p className="font-display text-base font-semibold text-ink">{statement.text}</p>
            <p className="mt-1 text-xs font-semibold text-ink-soft">
              {statement.isLie ? "The lie" : "Truth"} · {statement.votes} vote
              {statement.votes === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Detectives and victims</p>
        <p className="mt-2 text-sm font-semibold text-ink">
          Caught the lie: {reveal.correctGuessers.map((entry) => entry.name).join(", ") || "nobody"}
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">
          Fooled: {reveal.fooled.map((entry) => entry.name).join(", ") || "nobody"}
        </p>
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
