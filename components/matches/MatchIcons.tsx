import { Boot, SoccerBall } from "@phosphor-icons/react/dist/ssr";

/**
 * A goal and an assist, drawn rather than typed.
 *
 * These were emoji, which meant every reader saw a different picture: Apple's
 * football is a glossy sphere, Android's is flat, Windows draws a boot that
 * looks like a hiking boot on one version and a trainer on the next, and on a
 * machine with no emoji font at all they came out as boxes. A glyph from an
 * icon set renders the same everywhere and takes the colour of the text around
 * it, which emoji never do.
 */
export function GoalIcon({
  count = 1,
  size = 11,
  className = "",
}: {
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      title={`${count}골`}
      className={`inline-flex shrink-0 items-center gap-[1px] ${className}`}
    >
      <SoccerBall size={size} weight="fill" aria-hidden />
      {count > 1 && (
        <span className="tnum text-[0.85em] font-bold">{count}</span>
      )}
    </span>
  );
}

export function AssistIcon({
  count = 1,
  size = 11,
  className = "",
}: {
  count?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      title={`도움 ${count}`}
      className={`inline-flex shrink-0 items-center gap-[1px] ${className}`}
    >
      <Boot size={size} weight="fill" aria-hidden />
      {count > 1 && (
        <span className="tnum text-[0.85em] font-bold">{count}</span>
      )}
    </span>
  );
}
