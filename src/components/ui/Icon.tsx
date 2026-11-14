import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "users"
  | "gamepad"
  | "trophy"
  | "activity"
  | "search"
  | "bell"
  | "plus"
  | "arrow-right"
  | "arrow-left"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "menu"
  | "sun"
  | "moon"
  | "monitor"
  | "close"
  | "check"
  | "star"
  | "crown"
  | "sparkles"
  | "play"
  | "clock"
  | "user"
  | "settings"
  | "logout"
  | "link"
  | "dice"
  | "eye"
  | "zap"
  | "scale"
  | "brain"
  | "mask"
  | "flame"
  | "glass"
  | "trending"
  | "ban"
  | "shuffle"
  | "image"
  | "signal"
  | "folder"
  | "type"
  | "mic"
  | "puzzle"
  | "book"
  | "globe"
  | "smile"
  | "flag"
  | "chart"
  | "hand"
  | "wind"
  | "pin"
  | "key"
  | "sword"
  | "megaphone"
  | "target"
  | "rocket"
  | "heart"
  | "grid";

const paths: Record<IconName, React.ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20v-1.3A5.2 5.2 0 0 1 7.7 13h2.6a5.2 5.2 0 0 1 5.2 5.2V20zM16 4.8a3.4 3.4 0 0 1 0 6.4M17 14h.5a4 4 0 0 1 4 4v2h-4" /></>,
  gamepad: <><path d="M7 8.5h10a4.5 4.5 0 0 1 4.3 5.8l-1 3a2.4 2.4 0 0 1-3.8 1.1l-2.2-1.7H9.7l-2.2 1.7a2.4 2.4 0 0 1-3.8-1.1l-1-3A4.5 4.5 0 0 1 7 8.5Z" /><path d="M7 12v4m-2-2h4m7-1h.01M18 15h.01" /></>,
  trophy: <><path d="M8 4h8v3a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4 0v5m-4 4h8m-7-4h6v4H9z" /></>,
  activity: <path d="M2 12h4l3-7 5 14 3-7h5" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  "arrow-left": <path d="M20 12H4m6-6-6 6 6 6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  crown: <><path d="m3 7 4.5 4L12 5l4.5 6L21 7l-2 12H5z" /><path d="M5 19h14" /></>,
  sparkles: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 3l.7 1.8L8 5.5l-2.3.7L5 8l-.7-1.8L2 5.5l2.3-.7z" /></>,
  play: <path d="m9 6 9 6-9 6z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  link: <><path d="m10 13 4-4" /><path d="M8 17H6a4 4 0 0 1 0-8h4M16 7h2a4 4 0 1 1 0 8h-4" /></>,
  dice: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  scale: <><path d="M12 3v18M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z" /><path d="M8 21h8" /></>,
  brain: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-1 5.8V16a3 3 0 0 0 4 2.8V21h3V4zm6 0a3 3 0 0 1 3 3v1a3 3 0 0 1 1 5.8V16a3 3 0 0 1-4 2.8V21h-3V4z" />,
  mask: <><path d="M4 4h16v7a8 8 0 0 1-8 8 8 8 0 0 1-8-8z" /><path d="M8 10h.01M16 10h.01M9 14c1.8 1.3 4.2 1.3 6 0" /></>,
  flame: <path d="M12 22c4 0 7-2.8 7-6.5 0-4.7-4.5-7.5-4.5-11.5-2 1-4.5 3.7-4.5 7 0 1.5.5 2.5 1 3.2-2.2-.5-3-2.4-3-4.2C6 12 5 14 5 16c0 3.4 3 6 7 6Z" />,
  glass: <><path d="M5 3h14l-2 7a5 5 0 0 1-10 0z" /><path d="M12 15v6m-4 0h8" /></>,
  trending: <path d="m3 17 6-6 4 4 8-9m-6 0h6v6" />,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" /></>,
  shuffle: <path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
  signal: <path d="M5 19a14 14 0 0 1 14-14M8 19a11 11 0 0 1 11-11M12 19a7 7 0 0 1 7-7M19 19h.01" />,
  folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  type: <path d="M4 6V4h16v2M9 20h6M12 4v16" />,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" /></>,
  puzzle: <path d="M9 3a2 2 0 0 0-2 2h-3a1 1 0 0 0-1 1v4h2a2 2 0 1 1 0 4H3v4a1 1 0 0 0 1 1h4v-2a2 2 0 1 1 4 0v2h4a1 1 0 0 0 1-1v-4h-2a2 2 0 1 1 0-4h2V6a1 1 0 0 0-1-1h-4a2 2 0 0 0-3-2Z" />,
  book: <><path d="M4 5a3 3 0 0 1 3-3h13v18H7a3 3 0 0 0-3 3z" /><path d="M4 5v16" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14c1.8 1.3 6.2 1.3 8 0M9 9h.01M15 9h.01" /></>,
  flag: <path d="M5 22V3m0 1h12l-2 4 2 4H5" />,
  chart: <path d="M4 20V10m5 10V4m5 16v-7m5 7V7" />,
  hand: <path d="M8 12V5a2 2 0 1 1 4 0v6-8a2 2 0 1 1 4 0v8-6a2 2 0 1 1 4 0v9a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.7L4.5 14A2 2 0 0 1 8 12Z" />,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />,
  pin: <><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="9" r="2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-3 3 3 3m-6 0 3 3" /></>,
  sword: <path d="m14 4 6-2-2 6L8 18l-4-4zM6 16l-3 5 5-3M15 9l-2-2" />,
  megaphone: <><path d="m3 11 15-6v14L3 13zM6 14v5h4" /><path d="M21 10v4" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  rocket: <path d="M14 4c3-2 6-1 6-1s1 3-1 6l-5 5-4-4zM10 10l-5 1-2 3 5 1m1 4 1 5 3-2 1-5M6 18l-3 3" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
};

export function Icon({
  name,
  className = "h-5 w-5",
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

const emojiNames: Record<string, IconName> = {
  "👀": "eye", "🕵️": "search", "⚡": "zap", "⚖️": "scale", "🧠": "brain",
  "🔍": "search", "🔎": "search", "🎭": "mask", "🌶️": "flame", "🥃": "glass",
  "📈": "trending", "🚫": "ban", "🔀": "shuffle", "🖼️": "image", "📡": "signal",
  "🗂️": "folder", "🔥": "flame", "🔤": "type", "🎤": "mic", "🧩": "puzzle",
  "🤥": "mask", "📚": "book", "🏆": "trophy", "👑": "crown", "🎉": "sparkles",
  "🎲": "dice", "📺": "monitor", "🌙": "moon", "👋": "hand", "📌": "pin",
  "🏁": "flag", "💨": "wind", "📊": "chart", "🎮": "gamepad", "☺": "smile",
  "◎": "globe", "✦": "sparkles", "★": "star", "✓": "check", "✕": "close",
  "➜": "arrow-right", "←": "arrow-left", "‹": "chevron-left", "›": "chevron-right",
  "⌕": "search", "＋": "plus", "🤔": "brain", "✅": "check", "❌": "close",
  "🧊": "dice", "🐝": "heart", "🍯": "star", "🥁": "megaphone", "🍸": "glass",
  "🗣️": "megaphone", "🗝️": "key", "🦈": "rocket", "📝": "book", "📖": "book",
  "⭐": "star", "📉": "trending", "⏰": "clock", "🙈": "eye", "📜": "book",
  "👥": "users", "🛠️": "settings", "🚧": "settings",
};

export function EmojiIcon({
  value,
  className = "h-5 w-5",
}: {
  value?: string | null;
  className?: string;
}) {
  return <Icon name={(value && emojiNames[value]) || "sparkles"} className={className} />;
}
