/**
 * Turning whatever a page calls an author into a name, and into a reporter.
 *
 * This lives on its own because both ends of the pipeline need it: the
 * collector reads bylines out of feeds, and the hydrator reads them off the
 * article page afterwards. Keeping it here rather than in `index.ts` stops the
 * two importing each other.
 */
import type { Journalist } from "../types";

/**
 * Tidies a byline into a person's name.
 *
 * Feeds and pages put all sorts in this field: "By Adam Bate", a job title
 * after a comma, a bare handle, a link to an author page, or the newsroom
 * itself. What is wanted is the part a reader would recognise as a name.
 */
export function cleanByline(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, " ").trim();

  // A URL in the author field is a link to an author page. The slug is usually
  // the name: /author/steven-chicken
  if (/^https?:\/\//i.test(s)) {
    const slug = s.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? "";
    const name = slug.replace(/[-_]+/g, " ").trim();
    if (name.length < 3 || name.length > 60 || /^\d+$/.test(name)) return null;
    s = name.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  s = s.replace(/^(by|von|par|di|por|door)\s+/i, "");
  // "Matt Lawton, Chief Sports Reporter" — the role is not part of the name.
  s = s.split(/\s*[,|·|]\s*/)[0].trim();
  s = s.replace(/^@+/, "").trim();

  if (s.length < 3 || s.length > 60) return null;
  // A desk rather than a person. Checked as whole words so "Sam Wilson" and
  // "Jack Sport" survive while "Sport Desk" and "PA Media" do not.
  if (
    /^(staff|newsdesk|news desk|sport|sports|sport desk|sports desk|editorial|editor|the team|agency|reuters|pa media|afp|admin)$/i.test(
      s,
    )
  ) {
    return null;
  }
  return s;
}

/**
 * Finds the tracked reporter a byline belongs to, if any.
 *
 * Names arrive with titles attached and in the wrong case, so an exact match is
 * tried first and a containment match second - taking the longest registry name
 * that fits, or "Matt Lawton, Chief Sports Reporter" would match "Matt Law"
 * simply because it comes first in the file.
 */
export function matchByline(
  creator: string | null | undefined,
  journalists: Journalist[],
): Journalist | null {
  const cleaned = (creator ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!cleaned) return null;

  const active = journalists.filter((j) => j.active);
  const exact = active.find((j) => cleaned === j.en.toLowerCase());
  if (exact) return exact;

  let best: Journalist | null = null;
  for (const j of active) {
    if (j.en.length <= 6) continue;
    if (!cleaned.includes(j.en.toLowerCase())) continue;
    if (!best || j.en.length > best.en.length) best = j;
  }
  return best;
}
