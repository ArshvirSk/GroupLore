"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "framer-motion";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  type = "button",
  ...props
}: Omit<HTMLMotionProps<"button">, "children"> & {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const reduced = useReducedMotion();
  const variants = {
    primary: "bg-primary text-on-accent",
    secondary: "bg-secondary text-on-secondary",
    ghost: "bg-surface text-ink",
    danger: "bg-danger text-on-accent",
  };
  const sizes = {
    sm: "min-h-11 px-4 text-[12px]",
    md: "min-h-12 px-5 text-sm",
    lg: "min-h-14 px-7 text-base",
  };
  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      whileHover={reduced || disabled ? undefined : { x: -2, y: -2 }}
      whileTap={reduced || disabled ? undefined : { x: 3, y: 3 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[8px] border-[3px] border-border font-display font-bold uppercase tracking-[0.04em] shadow-hard-sm transition-shadow hover:shadow-hard-md active:shadow-none disabled:opacity-45 max-md:border-2",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </motion.button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: Omit<HTMLMotionProps<"button">, "children" | "aria-label"> & {
  label: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileHover={reduced ? undefined : { x: -2, y: -2 }}
      whileTap={reduced ? undefined : { x: 3, y: 3 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-border bg-surface text-ink shadow-hard-sm hover:shadow-hard-md active:shadow-none max-md:border-2",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function Card({
  children,
  variant = "flat",
  className = "",
  ...props
}: Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode;
  variant?: "flat" | "raised" | "interactive";
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      whileHover={variant === "interactive" && !reduced ? { x: -2, y: -2 } : undefined}
      whileTap={variant === "interactive" && !reduced ? { x: 3, y: 3 } : undefined}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      {...props}
      className={cn(
        "rounded-[8px] border-[3px] border-border bg-surface max-md:border-2",
        variant === "flat" && "shadow-hard-sm",
        variant === "raised" && "shadow-hard-md",
        variant === "interactive" &&
          "cursor-pointer shadow-hard-sm transition-shadow hover:shadow-hard-md active:shadow-none",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function Input({
  label,
  hint,
  error,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generated = useId();
  const inputId = id || generated;
  return (
    <label htmlFor={inputId} className="block">
      <span className="label mb-2 block text-ink">{label}</span>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          "h-12 w-full rounded-[8px] border-[3px] border-border bg-surface px-4 text-base font-medium text-ink placeholder:text-muted max-md:border-2",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {hint && !error ? (
        <span id={`${inputId}-hint`} className="mt-1.5 block text-sm text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${inputId}-error`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-danger">
          <span aria-hidden>!</span> {error}
        </span>
      ) : null}
    </label>
  );
}

export function CodeInput({
  value,
  onChange,
  label = "Room code",
  error,
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const chars = value.padEnd(6, " ").slice(0, 6).split("");
  return (
    <div>
      <span className="label mb-2 block text-ink">{label}</span>
      <div
        className="relative"
        onClick={() => ref.current?.focus()}
        role="presentation"
      >
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2" aria-hidden>
          {chars.map((char, index) => (
            <span
              key={index}
              className={cn(
                "flex h-12 items-center justify-center rounded-[8px] border-[3px] border-border bg-surface font-mono text-xl font-bold text-ink max-md:border-2",
                char.trim() && "bg-accent text-on-accent",
                error && "border-danger",
              )}
            >
              {char.trim() ? char : ""}
            </span>
          ))}
        </div>
        <input
          ref={ref}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 6),
            )
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") onEnter?.();
          }}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-label={label}
          aria-invalid={Boolean(error)}
          maxLength={6}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>
      {error ? (
        <span role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-danger">
          <span aria-hidden>!</span> {error}
        </span>
      ) : null}
    </div>
  );
}

export function Chip({
  children,
  active = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-border px-3 text-[12px] font-bold uppercase tracking-[0.08em]",
        active ? "bg-accent text-on-accent" : "bg-surface text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="label mb-2 text-ink">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-11 rounded-[8px] border-[3px] border-border px-4 py-3 text-left shadow-hard-sm max-md:border-2",
              value === option.value ? "bg-accent text-on-accent" : "bg-surface text-ink",
            )}
          >
            <span className="block font-display text-sm font-bold">{option.label}</span>
            {option.description ? (
              <span className="mt-0.5 block text-xs font-medium opacity-80">{option.description}</span>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "min-h-11 rounded-full border-[3px] border-border px-4 font-display text-sm font-bold shadow-hard-sm max-md:border-2",
            value === tab.value ? "bg-ink text-bg" : "bg-surface text-ink",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const AVATAR_SIZES = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
};

export function Avatar({
  name,
  src,
  size = "md",
  host = false,
  connected = true,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  host?: boolean;
  connected?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full border-[3px] border-border bg-surface-2 font-display font-bold text-ink max-md:border-2",
          AVATAR_SIZES[size],
          !connected && "opacity-50",
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          initials || "?"
        )}
      </span>
      {host ? (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-border bg-accent text-[10px] text-on-accent" aria-label="Host">
          ★
        </span>
      ) : null}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 5,
}: {
  people: { name: string; src?: string | null }[];
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center" aria-label={`${people.length} members`}>
      {shown.map((person, index) => (
        <span key={`${person.name}-${index}`} className={index ? "-ml-2" : ""}>
          <Avatar name={person.name} src={person.src} size="sm" />
        </span>
      ))}
      {rest > 0 ? (
        <span className="-ml-2 flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-border bg-surface px-1 font-mono text-xs font-bold text-ink">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "success" | "accent" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink",
    primary: "bg-primary text-on-accent",
    success: "bg-success text-on-accent",
    accent: "bg-accent text-on-accent",
    danger: "bg-danger text-on-accent",
  };
  return (
    <span className={cn("inline-flex min-h-7 items-center rounded-full border-2 border-border px-2.5 text-[12px] font-bold uppercase tracking-[0.08em]", tones[tone])}>
      {children}
    </span>
  );
}

export function Sticker({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-block -rotate-3 rounded-[8px] border-[3px] border-border bg-accent px-3 py-1 font-display text-sm font-bold uppercase tracking-[0.08em] text-on-accent shadow-hard-sm", className)}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[8px] border-[3px] border-border bg-surface p-5 shadow-hard-lg sm:rounded-[8px] sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
              <IconButton label="Close" onClick={onClose}>
                ✕
              </IconButton>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const ToastContext = createContext<{ show: (message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <ToastContext.Provider value={{ show: setMessage }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[90] -translate-x-1/2">
        {message ? (
          <div className="rounded-[8px] border-[3px] border-border bg-accent px-5 py-3 font-display text-sm font-bold text-on-accent shadow-hard-md">
            {message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

export function TimerBar({
  endsAt,
  serverNow,
  label = "Time remaining",
}: {
  endsAt: number | null;
  serverNow: number;
  label?: string;
}) {
  const [remaining, setRemaining] = useState(() => (endsAt ? Math.max(0, endsAt - serverNow) : 0));
  useEffect(() => {
    if (!endsAt) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 250)), 250);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const total = Math.max(1, endsAt - serverNow);
  const percent = Math.min(100, (remaining / total) * 100);
  const warning = percent <= 20;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label text-ink">{label}</span>
        <span className="font-mono text-xs font-bold text-ink">{Math.ceil(remaining / 1000)}s</span>
      </div>
      <div className="h-5 overflow-hidden rounded-[8px] border-[3px] border-border bg-surface-2 max-md:border-2" role="timer" aria-label={`${Math.ceil(remaining / 1000)} seconds remaining`}>
        <div
          className={cn("h-full transition-[width] duration-200", warning ? "bg-danger" : "bg-success")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[8px] border-2 border-border bg-surface-2", className)} />;
}

export function EmptyState({
  emoji = "✦",
  title,
  description,
  action,
}: {
  emoji?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[8px] border-[3px] border-dashed border-border bg-surface p-8 text-center shadow-hard-sm max-md:border-2">
      <span className="text-4xl" aria-hidden>{emoji}</span>
      <h3 className="mt-3 font-display text-xl font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export { default as ThemeToggle } from "./ThemeToggle";
