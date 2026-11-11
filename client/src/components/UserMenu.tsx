"use client";

import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";

export default function UserMenu() {
  const { displayName, avatarUrl, isSignedIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isSignedIn) return null;

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 transition hover:border-white/25"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/25 text-[10px] font-bold text-violet-200">
            {initials || "?"}
          </span>
        )}
        <span className="max-w-28 truncate text-xs font-semibold text-zinc-300">
          {displayName}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#111115] shadow-xl">
          <div className="border-b border-white/5 px-4 py-3">
            <p className="truncate text-xs font-semibold text-white">
              {displayName}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
              Supabase account
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signOut();
              } finally {
                setBusy(false);
                setOpen(false);
              }
            }}
            className="w-full px-4 py-3 text-left text-xs font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
