/**
 * The measure every match page is set to.
 *
 * These pages are documents, not feeds. A fixture row is a club, a time and a
 * club, and stretched across a wide monitor it becomes a cluster of content
 * marooned in the middle of two empty gutters - measured at 1960px, the row
 * content occupied 550px and the rest was nothing. A table and a match report
 * have the same problem for the same reason.
 *
 * 52rem holds a fixture row without the two clubs drifting apart, and a
 * statistics bar without its two numbers needing a second glance to pair up.
 *
 * The wrapper goes inside each section rather than around the page, so rules
 * and sticky bars still run the full width of the column. Only the content is
 * held in.
 */
export const MEASURE = "mx-auto w-full max-w-[52rem]";

/**
 * No measure at all, for a match report.
 *
 * A fixture row is two clubs and a time and reads best held in. A pitch is a
 * diagram of twenty-two people with their names beside them, and every rem it
 * loses is width the back four has to share - so the report takes the whole
 * column and the pitch grows with the window.
 */
export const MEASURE_WIDE = "w-full";

export function Measure({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${MEASURE} ${className}`}>{children}</div>;
}
