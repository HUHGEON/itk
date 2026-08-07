import { NextResponse } from "next/server";
import { getFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

function csv(v: string | null): string[] {
  return (v ?? "").split(",").filter(Boolean);
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;

  // Cursor arrives as the last row of the previous page. Both halves are
  // required — a timestamp alone skips rows that share a minute.
  const beforeAt = Number(p.get("beforeAt"));
  const beforeId = p.get("beforeId");
  const cursor =
    Number.isFinite(beforeAt) && beforeAt > 0 && beforeId
      ? { publishedAt: beforeAt, id: beforeId }
      : undefined;

  const rows = await getFeed({
    tiers: csv(p.get("tier"))
      .map(Number)
      .filter((n) => !Number.isNaN(n)),
    teams: csv(p.get("team")),
    journalistId: p.get("who") ?? undefined,
    league: p.get("league") ?? undefined,
    q: p.get("q") ?? undefined,
    after: Number(p.get("after")) || undefined,
    cursor,
    // The browser alert poller wants everything; the feed wants attributable
    // stories only, which is why this is explicit rather than defaulted.
    tieredOnly: p.get("feed") !== "all" && p.get("all") !== "1",
    limit: Math.min(Number(p.get("limit")) || 60, 200),
  });

  return NextResponse.json({ rows });
}
