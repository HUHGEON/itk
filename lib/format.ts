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
 * Tier as a colour and a weight.
 *
 * The colour is what lets you tell 1 from 1.5 without reading; the weight is
 * what makes a 0-tier byline louder than a 3-tier one. A solid block at the
 * top, a tint in the middle, bare text at the bottom.
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

const HUE: Record<string, string> = {
  "0": "var(--tier-0)",
  "1": "var(--tier-1)",
  "1.5": "var(--tier-15)",
  "2": "var(--tier-2)",
  "3": "var(--tier-3)",
};

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
      border: "transparent",
      ink: "var(--accent-ink)",
    };
  }

  const key = tier === null ? "" : String(tier);
  const color = HUE[key] ?? "var(--muted)";
  const w = LADDER[key] ?? 0;

  // Top of the ladder: a solid block, dark type on it.
  if (w >= 1) {
    return {
      weight: w,
      color,
      bg: color,
      border: "transparent",
      ink: "var(--accent-ink)",
    };
  }
  // Middle: the hue as a tint, so it still reads as its own colour.
  if (w >= 0.4) {
    return {
      weight: w,
      color,
      bg: `color-mix(in srgb, ${color} 16%, transparent)`,
      border: `color-mix(in srgb, ${color} 42%, transparent)`,
      ink: color,
    };
  }
  // Bottom: outline only.
  return {
    weight: w,
    color,
    bg: "transparent",
    border: `color-mix(in srgb, ${color} 34%, transparent)`,
    ink: color,
  };
}

/** The rule down the left edge of a row — presence, not decoration. */
export function tierRule(tier: number | null, official = false): string {
  if (official) return "var(--official)";
  const key = tier === null ? "" : String(tier);
  const color = HUE[key];
  const w = LADDER[key] ?? 0;
  if (!color || w === 0) return "transparent";
  return `color-mix(in srgb, ${color} ${Math.round(30 + w * 70)}%, transparent)`;
}

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
