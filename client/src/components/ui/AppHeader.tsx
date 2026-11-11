"use client";

import ThemeToggle from "@/components/ui/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AppHeader({
  backHref,
  backLabel,
  right,
  onLeaveGroup,
}: {
  backHref?: string;
  backLabel?: string;
  right?: ReactNode;
  onLeaveGroup?: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/95">
      <div className="mx-auto flex min-h-16 w-full max-w-[1120px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="group flex min-h-11 items-center gap-2 font-display text-lg font-semibold tracking-[-0.03em] text-ink"
        >
          <span className="flex h-9 w-9 -rotate-3 items-center justify-center rounded-[12px] bg-primary-soft font-bold text-primary transition-transform group-hover:rotate-0">
            G
          </span>
          <span>GroupLore</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Hub
          </Link>
          {process.env.NODE_ENV !== "production" ? (
            <Link
              href="/dev/ui"
              className="flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              UI kit
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-2">
          {right}
          <ThemeToggle />
          <UserMenu onLeaveGroup={onLeaveGroup} />
        </div>
      </div>
      {backHref ? (
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-3 sm:px-6">
          <Link
            href={backHref}
            className="inline-flex min-h-8 items-center text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            ← {backLabel || "Back"}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
