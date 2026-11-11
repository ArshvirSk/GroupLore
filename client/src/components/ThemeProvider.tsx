"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

export type ThemeChoice = "light" | "dark" | "system";
type AppliedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeChoice;
  applied: AppliedTheme;
  setTheme: (theme: ThemeChoice) => void;
};

const STORAGE_KEY = "grouplore-theme";
const CHANGE_EVENT = "grouplore-theme-change";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function storedTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") {
      return value;
    }
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
  return "system";
}

function systemTheme(): AppliedTheme {
  if (typeof window === "undefined") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function resolve(theme: ThemeChoice): AppliedTheme {
  return theme === "system" ? systemTheme() : theme;
}

function subscribe(onChange: () => void) {
  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    // No color-scheme support means only explicit changes matter.
  }
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  media?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    media?.removeEventListener("change", onChange);
  };
}

function applyTheme(theme: ThemeChoice) {
  if (typeof document === "undefined") return;
  const applied = resolve(theme);
  document.documentElement.dataset.theme = applied;
  document.documentElement.style.colorScheme = applied;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useSyncExternalStore(
    subscribe,
    storedTheme,
    () => "system" as const,
  );
  const applied = resolve(theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The in-memory event still updates this tab.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({ theme, applied, setTheme }),
    [theme, applied, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
