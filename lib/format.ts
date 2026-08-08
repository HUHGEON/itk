/** "1.5" -> "15" so it can key a CSS class or a Record. */
export function tierKey(tier: number | null): string {
  if (tier === null) return "none";
  return String(tier).replace(".", "");
}

export function tierLabel(tier: number | null): string {
  if (tier === null) return "미분류";
  return `${tier}티어`;
}

/**
 * Tier as one colour at five strengths.
 *
 * Five separate hues read as five unrelated categories; the tier list is a
 * ladder, so it is drawn as one — a 0-tier byline is a solid block, a 3-tier
 * one is grey text. `weight` is what everything else keys off: the badge fill,
 * the rule down the left edge of a row, the chip in the filter rail.
 */
export interface TierStyle {
  /** 1 at the top of the ladder, 0 at the bottom */
  weight: number;
  color: string;
  /** badge background */
  bg: string;
  border: string;
  /** text colour that sits on `bg` */
  ink: string;
}

const LADDER: Record<string, number> = {
  "0": 1,
  "1": 0.72,
  "1.5": 0.5,
  "2": 0.24,
  "3": 0.12,
};

export function tierStyle(tier: number | null, official = false): TierStyle {
  if (official) {
    return {
      weight: 1,
      color: "var(--official)",
      bg: "var(--official)",
      border: "var(--official)",
      ink: "var(--accent-ink)",
    };
  }

  const w = tier === null ? 0 : (LADDER[String(tier)] ?? 0);

  // Above the midpoint the badge is filled and shouts; below it, it recedes to
  // an outline so a page of 2- and 3-tier chatter stays quiet.
  if (w >= 0.7) {
    return {
      weight: w,
      color: "var(--accent)",
      bg: `color-mix(in srgb, var(--accent) ${Math.round(w * 100)}%, transparent)`,
      border: "transparent",
      ink: "var(--accent-ink)",
    };
  }
  if (w >= 0.4) {
    return {
      weight: w,
      color: "var(--accent)",
      bg: "color-mix(in srgb, var(--accent) 14%, transparent)",
      border: "color-mix(in srgb, var(--accent) 34%, transparent)",
      ink: "var(--accent)",
    };
  }
  return {
    weight: w,
    color: "var(--muted)",
    bg: "transparent",
    border: "var(--border-strong)",
    ink: "var(--muted)",
  };
}

/** The rule down the left edge of a row — presence, not decoration. */
export function tierRule(tier: number | null, official = false): string {
  if (official) return "var(--official)";
  const w = tier === null ? 0 : (LADDER[String(tier)] ?? 0);
  if (w === 0) return "transparent";
  return `color-mix(in srgb, var(--accent) ${Math.round(w * 100)}%, transparent)`;
}

/** Kept for callers that only need a single colour (badges, counts). */
export function tierColor(tier: number | null): string {
  return tierStyle(tier).color;
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
  return new Date(ts).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
}
