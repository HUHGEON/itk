import { NextResponse } from "next/server";
import { getFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

function csv(v: string | null): string[] {
  return (v ?? "").split(",").filter(Boolean);
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const rows = await getFeed({
    tiers: csv(url.searchParams.get("tier"))
      .map(Number)
      .filter((n) => !Number.isNaN(n)),
    teams: csv(url.searchParams.get("team")),
    league: url.searchParams.get("league") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    after: Number(url.searchParams.get("after")) || undefined,
    limit: Math.min(Number(url.searchParams.get("limit")) || 60, 200),
  });

  return NextResponse.json({ rows });
}
