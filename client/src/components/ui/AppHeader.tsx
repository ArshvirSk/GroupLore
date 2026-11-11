"use client";

import ThemeToggle from "@/components/ui/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function AppHeader({
  backHref,
  backLabel,
  right,
}: {
  backHref?: string;
  backLabel?: string;
  right?: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-border bg-bg/95 max-md:border-b-2">
      <div className="mx-auto flex min-h-16 w-full max-w-[1120px] items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex min-h-11 items-center rounded-[8px] border-2 border-border bg-surface px-3 font-display text-xs font-bold uppercase tracking-[0.08em] text-ink shadow-hard-sm"
            >
              ← {backLabel || "Back"}
            </Link>
          ) : null}
          <Link href="/" className="flex min-h-11 items-center gap-2 font-display text-lg font-bold tracking-[-0.04em] text-ink">
            <span className="flex h-9 w-9 rotate-[-3deg] items-center justify-center rounded-[8px] border-[3px] border-border bg-accent font-black text-on-accent shadow-hard-sm">
              G
            </span>
            <span>
              GROUP<span className="text-primary">LORE</span>
            </span>
          </Link>
        </div>
        <nav className="hidden items-center gap-2 sm:flex" aria-label="Primary">
          {pathname !== "/" ? (
            <Link href="/dashboard" className="min-h-11 px-3 py-3 font-display text-xs font-bold uppercase tracking-[0.08em] text-ink hover:underline">
              Hub
            </Link>
          ) : null}
          <Link href="/dev/ui" className="min-h-11 px-3 py-3 font-display text-xs font-bold uppercase tracking-[0.08em] text-ink hover:underline">
            UI kit
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {right}
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
