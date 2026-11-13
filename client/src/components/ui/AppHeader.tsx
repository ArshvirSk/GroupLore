"use client";

import ThemeToggle from "@/components/ui/ThemeToggle";
import { Icon } from "@/components/ui/Icon";
import UserMenu from "@/components/UserMenu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/activity", label: "Activity" },
];

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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1220px] items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link href="/" className="group flex min-h-11 items-center gap-2 text-ink" aria-label="GroupLore home">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ink bg-primary text-ink shadow-[2px_2px_0_var(--ink)]"><Icon name="sparkles" className="h-4 w-4" /></span>
          <span className="font-display text-xl font-black italic tracking-[-0.06em]">GroupLore</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                isActive(link.href)
                  ? "bg-primary-soft text-primary"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {right}
          <ThemeToggle />
          <UserMenu onLeaveGroup={onLeaveGroup} />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink sm:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? "close" : "menu"} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav id="public-mobile-nav" className="border-t border-border bg-bg px-4 pb-4 pt-2 sm:hidden" aria-label="Mobile">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold ${
                isActive(link.href) ? "bg-primary-soft text-primary" : "text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {backHref ? (
        <div className="mx-auto w-full max-w-[1220px] px-4 pb-3 sm:px-6">
          <Link
            href={backHref}
            className="inline-flex min-h-8 items-center text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <Icon name="arrow-left" className="mr-1.5 h-4 w-4" /> {backLabel || "Back"}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
