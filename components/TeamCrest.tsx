import type { Team } from "@/lib/types";

/**
 * Crest when we have one, otherwise a lettered disc — the feed should never
 * show a broken image just because a badge fetch failed.
 */
export function TeamCrest({ team, size = 20 }: { team: Team; size?: number }) {
  if (team.crest) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.crest}
        alt={team.ko}
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-surface-3 font-bold text-muted"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {team.en.slice(0, 1)}
    </span>
  );
}
