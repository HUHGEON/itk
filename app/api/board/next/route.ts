import { NextResponse } from "next/server";
import { nextForClubs } from "@/lib/matches";

/**
 * What each followed club is doing next, in one request.
 *
 * Same story as the board: `nextForClubs` sweeps a fortnight of every
 * competition, which is 23 requests from the browser, and the strip was asking
 * for them every five seconds whether or not anything was in play.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("teams") ?? "";
  const teams = raw.split(",").filter(Boolean).slice(0, 40);
  if (teams.length === 0) return NextResponse.json({});

  try {
    const byClub = await nextForClubs(teams);
    return NextResponse.json(byClub, {
      headers: {
        "cache-control":
          "public, max-age=0, s-maxage=5, stale-while-revalidate=10",
      },
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }
}
