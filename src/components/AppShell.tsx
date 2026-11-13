"use client";

import { useAuth } from "@/components/AuthProvider";
import ThemeToggle from "@/components/ui/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { Icon, type IconName } from "@/components/ui/Icon";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

export type AppNavKey = "home" | "groups" | "games" | "leaderboard" | "activity";

const NAV: { key: AppNavKey; label: string; icon: IconName; href: string }[] = [
  { key: "home", label: "Home", icon: "home", href: "/dashboard" },
  { key: "groups", label: "My Groups", icon: "users", href: "/groups" },
  { key: "games", label: "Browse Games", icon: "gamepad", href: "/games" },
  { key: "leaderboard", label: "Leaderboard", icon: "trophy", href: "/leaderboard" },
  { key: "activity", label: "Activity", icon: "activity", href: "/activity" },
];

function resolveActive(pathname: string, fallback: AppNavKey): AppNavKey {
  if (pathname.startsWith("/group") || pathname.startsWith("/groups")) return "groups";
  if (pathname.startsWith("/lobby") || pathname.startsWith("/game") || pathname.startsWith("/games")) return "games";
  if (pathname.startsWith("/leaderboard")) return "leaderboard";
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/dashboard")) return "home";
  return fallback;
}

export function AppNav({ active, mobile = false }: { active: AppNavKey; mobile?: boolean }) {
  const pathname = usePathname();
  const current = resolveActive(pathname, active);
  return (
    <nav className={mobile ? "mobile-nav" : "app-nav"} aria-label="Primary">
      {NAV.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={current === item.key ? "page" : undefined}
          className={current === item.key ? "active" : undefined}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default function AppShell({
  active,
  children,
  search = false,
  contentClassName = "",
}: {
  active: AppNavKey;
  children: ReactNode;
  search?: boolean;
  contentClassName?: string;
}) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [query, setQuery] = useState("");

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/games?q=${encodeURIComponent(trimmed)}` : "/games");
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/dashboard" className="app-brand" aria-label="GroupLore home">
          <Image src="/assets/grouplore/wordmark-transparent.png" alt="GroupLore" width={401} height={158} priority />
        </Link>
        <AppNav active={active} />
        <Link className="app-create" href="/groups#create">
          <span><b>Create a Group</b><small>Start a new crew</small></span>
          <i><Icon name="plus" /></i>
        </Link>
        <div className="app-sidebar-art" aria-hidden="true">
          <Image src="/assets/grouplore/library-starburst.png" alt="" fill sizes="260px" />
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <Link href="/dashboard" className="app-mobile-brand" aria-label="GroupLore home">
            <Image src="/assets/grouplore/wordmark-transparent.png" alt="GroupLore" width={401} height={158} priority />
          </Link>
          <div className="app-toolbar">
            {search ? (
              <form className="app-search" onSubmit={submitSearch} role="search">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search games"
                  aria-label="Search games"
                />
              </form>
            ) : null}
            <Link className="app-icon-button" href="/activity" aria-label="Recent activity">
              <Icon name="bell" />
              <span aria-hidden="true" />
            </Link>
            <ThemeToggle />
            {isSignedIn ? <UserMenu /> : <Link href="/sign-in" className="app-signin"><Icon name="user" /> Sign in</Link>}
          </div>
        </header>
        <div className={`app-page ${contentClassName}`}>{children}</div>
      </div>

      <AppNav active={active} mobile />
    </div>
  );
}
