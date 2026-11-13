"use client";

import { Icon } from "@/components/ui/Icon";

import AnswerInput from "@/components/game/AnswerInput";
import PromptCard from "@/components/game/PromptCard";
import type { RoomView } from "@/stores/roomStore";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

type Spectrum = { low: string; high: string };
type WavelengthReveal = {
  spectrum: Spectrum;
  target: number;
  clue: string;
  clueGiverId: string;
  clueGiverName: string;
  average: number | null;
  distance: number | null;
  guesses: {
    playerId: string;
    name: string;
    value: number;
    distance: number;
    points: number;
  }[];
  roundPoints: { playerId: string; name: string; points: number }[];
};

export type WavelengthView = {
  phase: "clue" | "guess" | "reveal";
  round: number;
  rounds: number;
  mode: string;
  isClueGiver: boolean;
  clueGiverName: string;
  spectrum: Spectrum;
  target?: number | null;
  clueMs?: number;
  clue?: string;
  submitted?: number;
  total?: number;
  myGuess?: number | null;
  reveal?: WavelengthReveal | null;
};

export default function WavelengthGame({
  view,
  send,
}: {
  room: RoomView;
  view: WavelengthView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const reduced = useReducedMotion();
  const spectrum = view.spectrum;
  const target = view.target;

  if (view.phase === "clue") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Set the wavelength" icon="signal">
          {view.isClueGiver
            ? `Give a clue that lands near ${target ?? "the hidden point"} on the spectrum.`
            : `${view.clueGiverName} is finding the wavelength…`}
        </PromptCard>

        <SpectrumBar spectrum={spectrum} target={view.isClueGiver ? target : null} />

        {view.isClueGiver ? (
          <div className="party-card p-5">
            <AnswerInput
              autoFocus
              maxLength={100}
              placeholder="Your clue…"
              submitLabel="Send clue"
              onSubmit={(value) => send("clue", { value })}
            />
            <p className="mt-3 text-center text-xs font-bold text-ink-soft">
              The group will guess the number. Don&apos;t say the number.
            </p>
          </div>
        ) : (
          <div className="party-card p-6 text-center">
            <Icon name="eye" className="mx-auto h-8 w-8" />
            <p className="mt-2 font-display text-lg font-semibold text-ink">
              Wait for the clue.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (view.phase === "guess") {
    return (
      <div className="space-y-4">
        <PromptCard kicker="Where does it land?" icon="signal" compact>
          {view.clue}
        </PromptCard>

        <SpectrumBar spectrum={spectrum} target={null} />

        {view.isClueGiver ? (
          <div className="party-card p-6 text-center">
            <Icon name="mask" className="mx-auto h-8 w-8" />
            <p className="mt-2 font-display text-lg font-semibold text-ink">
              The group is guessing.
            </p>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              {view.submitted}/{view.total} guesses in
            </p>
          </div>
        ) : (
          <GuessControls
            key={view.round}
            view={view}
            send={send}
          />
        )}
      </div>
    );
  }

  const reveal = view.reveal;
  if (!reveal) return null;

  return (
    <div className="space-y-4">
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="party-card bg-mint/35 p-6 text-center"
      >
        <Icon name="signal" className="mx-auto h-10 w-10" />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
          The wavelength was {reveal.target}
        </p>
        <p className="mt-1 font-display text-xl font-semibold text-ink">
          {reveal.spectrum.low} → {reveal.spectrum.high}
        </p>
        <p className="mt-2 text-sm font-bold text-ink-soft">
          Clue: “{reveal.clue}”
        </p>
        <p className="mt-1 text-sm font-bold text-ink-soft">
          Average guess: {reveal.average ?? "—"}
          {reveal.distance !== null ? ` · ${reveal.distance} away` : ""}
        </p>
      </motion.div>

      <SpectrumBar spectrum={reveal.spectrum} target={reveal.target} average={reveal.average} />

      <div className="party-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
          Guesses
        </p>
        <div className="mt-2 space-y-2">
          {reveal.guesses.map((entry) => (
            <div
              key={entry.playerId}
              className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-ink"
            >
              <span>{entry.name}</span>
              <span>
                {entry.value} · {entry.points > 0 ? `+${entry.points}` : "miss"}
              </span>
            </div>
          ))}
        </div>
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

function GuessControls({
  view,
  send,
}: {
  view: WavelengthView;
  send: (type: string, data?: Record<string, unknown>) => void;
}) {
  const [guess, setGuess] = useState(view.myGuess ?? 50);
  const locked = view.myGuess !== null && view.myGuess !== undefined;

  return (
    <div className="party-card p-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
        Drag the marker to your guess
      </p>
      <input
        type="range"
        min={0}
        max={100}
        value={guess}
        disabled={locked}
        onChange={(event) => setGuess(Number(event.target.value))}
        className="w-full accent-grape"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-3xl font-semibold text-ink">
          {view.myGuess ?? guess}
        </span>
        <button
          type="button"
          disabled={locked}
          onClick={() => send("guess", { value: guess })}
          className="min-h-11 rounded-2xl bg-grape px-5 font-display text-sm font-semibold text-white shadow-soft transition enabled:hover:bg-[#7C4DEB] disabled:opacity-40"
        >
          {locked ? "Locked in" : "Lock guess"}
        </button>
      </div>
      <p className="mt-2 text-center text-xs font-bold uppercase tracking-wide text-ink-soft">
        {view.submitted}/{view.total} guessed
      </p>
    </div>
  );
}

function SpectrumBar({
  spectrum,
  target,
  average,
}: {
  spectrum: Spectrum;
  target?: number | null;
  average?: number | null;
}) {
  return (
    <div className="party-card p-5">
      <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-ink-soft">
        <span>{spectrum.low}</span>
        <span>{spectrum.high}</span>
      </div>
      <div className="relative mt-3 h-4 rounded-full bg-gradient-to-r from-babyblue via-lavender to-coral">
        {typeof target === "number" && (
          <span
            className="absolute top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow-soft"
            style={{ left: `${target}%` }}
            aria-label={`Target ${target}`}
          />
        )}
        {typeof average === "number" && (
          <span
            className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-grape shadow-soft"
            style={{ left: `${average}%` }}
            aria-label={`Average guess ${average}`}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wide text-ink-soft">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}
