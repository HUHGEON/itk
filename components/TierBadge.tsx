import { tierColor, tierLabel } from "@/lib/format";

export function TierBadge({ tier, size = "sm" }: { tier: number | null; size?: "sm" | "xs" }) {
  const color = tierColor(tier);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded font-bold tracking-tight ${
        size === "xs" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      {tierLabel(tier)}
    </span>
  );
}
