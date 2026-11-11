"use client";

import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/ui";
import Link from "next/link";
import { useState } from "react";

export default function UserMenu({
  onLeaveGroup,
}: {
  onLeaveGroup?: () => void;
}) {
  const { displayName, avatarUrl, isSignedIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isSignedIn) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-ink transition-colors hover:bg-surface-2"
      >
        <Avatar name={displayName} src={avatarUrl} size="sm" />
        <span className="hidden max-w-32 truncate text-sm font-medium text-ink sm:inline">
          {displayName}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            <p className="mt-0.5 text-xs text-muted">Signed in</p>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center px-4 text-sm font-medium text-ink hover:bg-surface-2"
          >
            Profile
          </Link>
          {onLeaveGroup ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLeaveGroup();
              }}
              className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-danger hover:bg-surface-2"
            >
              Leave group
            </button>
          ) : null}
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
            className="flex min-h-11 w-full items-center border-t border-border px-4 text-left text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
