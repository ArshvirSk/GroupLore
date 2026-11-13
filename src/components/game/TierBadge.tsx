"use client";

const TIERS: Record<string, { label: string; className: string }> = {
  top: { label: "Top answer", className: "bg-honey text-ink" },
  second: { label: "Runner-up", className: "bg-babyblue text-ink" },
  shared: { label: "Shared", className: "bg-mint text-ink" },
  unique: { label: "Unique", className: "bg-ink/10 text-ink-soft" },
};

export default function TierBadge({
  tier,
  points,
}: {
  tier: keyof typeof TIERS | string;
  points?: number;
}) {
  const value = TIERS[tier] || TIERS.unique;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${value.className}`}
      >
        {value.label}
      </span>
      {typeof points === "number" && (
        <span className="font-display text-sm font-semibold text-grape">
          +{points}
        </span>
      )}
    </span>
  );
}
