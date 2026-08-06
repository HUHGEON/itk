/** "1.5" -> "15" so it can key a CSS class or a Record. */
export function tierKey(tier: number | null): string {
  if (tier === null) return "none";
  return String(tier).replace(".", "");
}

export function tierLabel(tier: number | null): string {
  if (tier === null) return "미분류";
  return `${tier}티어`;
}

const TIER_COLORS: Record<string, string> = {
  "0": "var(--tier-0)",
  "1": "var(--tier-1)",
  "1.5": "var(--tier-15)",
  "2": "var(--tier-2)",
  "3": "var(--tier-3)",
};

export function tierColor(tier: number | null): string {
  if (tier === null) return "var(--muted)";
  return TIER_COLORS[String(tier)] ?? "var(--muted)";
}

export function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}
