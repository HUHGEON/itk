import { rpc } from "./supabase";

export interface FeedFilters {
  tiers?: number[];
  teams?: string[];
  journalistId?: string;
  league?: string;
  /** full-text query against the headline (English + Korean) */
  q?: string;
  limit?: number;
  /**
   * Pagination cursor — the last row of the previous page. Composite because
   * several feeds stamp a whole batch with the same minute, and a
   * timestamp-only cursor silently drops the rest of that batch.
   */
  cursor?: { publishedAt: number; id: string };
  /** only articles first seen after this timestamp — used by the notifier */
  after?: number;
  /** the default view: only stories attributable to a ranked reporter */
  tieredOnly?: boolean;
}

export interface FeedRow {
  id: string;
  url: string;
  title: string;
  snippet: string;
  source: string;
  publishedAt: number;
  tier: number | null;
  titleKo: string | null;
  summaryKo: string | null;
  imageUrl: string | null;
  journalistId: string | null;
  journalistKo: string | null;
  journalistEn: string | null;
  outlet: string | null;
  x: string | null;
  /** journalist the story credits, when it isn't their own byline */
  citedKo: string | null;
  /** the club's own announcement */
  official: boolean;
  teams: string[];
}

interface FeedRpcRow {
  id: string;
  url: string;
  title: string;
  snippet: string | null;
  source: string | null;
  published_at: string;
  tier: number | null;
  title_ko: string | null;
  summary_ko: string | null;
  image_url: string | null;
  journalist_id: string | null;
  journalist_ko: string | null;
  journalist_en: string | null;
  outlet: string | null;
  handle: string | null;
  cited_id: string | null;
  cited_ko: string | null;
  official: boolean | null;
  teams: string[] | null;
}

/** `undefined` filters must reach Postgres as SQL NULL, not be omitted. */
function orNull<T>(v: T | undefined | null): T | null {
  return v ?? null;
}

export async function getFeed(filters: FeedFilters = {}): Promise<FeedRow[]> {
  const {
    tiers, teams, journalistId, league, q,
    limit = 60, cursor, after, tieredOnly = false,
  } = filters;

  const rows = await rpc<FeedRpcRow[]>("itk_feed", {
    p_tiers: tiers?.length ? tiers : null,
    p_teams: teams?.length ? teams : null,
    p_journalist_id: orNull(journalistId),
    p_league: orNull(league),
    p_q: q?.trim() ? q.trim() : null,
    p_before: cursor ? new Date(cursor.publishedAt).toISOString() : null,
    p_before_id: cursor?.id ?? null,
    p_after: after ? new Date(after).toISOString() : null,
    p_limit: limit,
    p_tiered_only: tieredOnly,
  });

  return (rows ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    snippet: r.snippet ?? "",
    source: r.source ?? "",
    publishedAt: Date.parse(r.published_at),
    tier: r.tier,
    titleKo: r.title_ko,
    summaryKo: r.summary_ko,
    imageUrl: r.image_url,
    journalistId: r.journalist_id,
    journalistKo: r.journalist_ko,
    journalistEn: r.journalist_en,
    outlet: r.outlet,
    x: r.handle,
    citedKo: r.cited_ko,
    official: Boolean(r.official),
    teams: r.teams ?? [],
  }));
}

/**
 * Counts shown on the filter chips.
 *
 * They take the *other* active filters so the numbers describe the combination
 * on screen — picking a journalist should change what each club's badge says,
 * not leave a fixed total sitting there.
 */
export async function getJournalistActivity(
  filters: Pick<FeedFilters, "teams" | "league" | "q"> = {},
  hours = 168,
) {
  const rows = await rpc<{ journalist_id: string; n: number }[]>(
    "itk_journalist_activity",
    {
      p_hours: hours,
      p_teams: filters.teams?.length ? filters.teams : null,
      p_league: orNull(filters.league),
      p_q: filters.q?.trim() ? filters.q.trim() : null,
    },
  );

  const map: Record<string, number> = {};
  for (const r of rows ?? []) map[r.journalist_id] = Number(r.n);
  return map;
}

/** Article counts per team, likewise scoped to the other active filters. */
export async function getTeamActivity(
  filters: Pick<FeedFilters, "tiers" | "journalistId" | "league" | "q" | "tieredOnly"> = {},
  hours = 48,
) {
  const rows = await rpc<{ slug: string; n: number; best_tier: number | null }[]>(
    "itk_team_activity",
    {
      p_hours: hours,
      p_tiers: filters.tiers?.length ? filters.tiers : null,
      p_journalist_id: orNull(filters.journalistId),
      p_league: orNull(filters.league),
      p_q: filters.q?.trim() ? filters.q.trim() : null,
      p_tiered_only: filters.tieredOnly ?? false,
    },
  );

  const map: Record<string, { count: number; bestTier: number | null }> = {};
  for (const r of rows ?? []) {
    map[r.slug] = { count: Number(r.n), bestTier: r.best_tier };
  }
  return map;
}
