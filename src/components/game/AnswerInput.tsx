"use client";

import { useState } from "react";

export default function AnswerInput({
  onSubmit,
  disabled = false,
  placeholder = "Type your answer…",
  maxLength = 120,
  submitLabel = "Submit",
  autoFocus = false,
}: {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <form
      className="flex w-full items-stretch gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit(value.trim());
        setValue("");
      }}
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-transparent bg-white px-4 text-base font-semibold text-ink shadow-soft outline-none transition placeholder:text-ink-soft/60 focus:border-grape disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-12 shrink-0 rounded-2xl bg-grape px-5 font-display text-sm font-semibold text-white shadow-soft transition enabled:hover:bg-[#7C4DEB] disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}
