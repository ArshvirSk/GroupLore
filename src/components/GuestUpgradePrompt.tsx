"use client";

import { useAuth } from "@/components/AuthProvider";
import { upgradeGuestAccount } from "@/lib/guest";
import { useState } from "react";

export default function GuestUpgradePrompt() {
  const { isGuest, displayName } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isGuest) return null;

  if (done) {
    return (
      <div className="rounded-2xl border border-mint/30 bg-mint/10 p-4 text-center text-sm font-semibold text-ink">
        Account saved. Your guest id and game history are still yours.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-grape/20 bg-lavender/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-base font-semibold text-ink">
            Save your progress
          </p>
          <p className="text-xs font-semibold text-ink-soft">
            Keep this player id, lobby history and lore by adding an account.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-10 rounded-full bg-grape px-5 text-xs font-bold uppercase tracking-wide text-white"
          >
            Add account
          </button>
        )}
      </div>

      {open && (
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await upgradeGuestAccount({ email, password, displayName });
              setDone(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save account");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="min-h-10 rounded-xl border border-ink/10 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-grape"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password (6+)"
            className="min-h-10 rounded-xl border border-ink/10 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-grape"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-10 rounded-xl bg-grape px-5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {error && (
            <p className="text-xs font-bold text-[#B83232] sm:col-span-3">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}
