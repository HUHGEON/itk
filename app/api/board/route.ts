import { NextResponse } from "next/server";
import { matchesOn, seoulDay } from "@/lib/matches";

/**
 * A whole day's board in one request.
 *
 * The browser used to build this itself. `matchesOn` asks the fixture source
 * once per competition and once per UTC day either side of the Korean one, so
 * a single refresh was 23 requests - and while anything is in play the board
 * refreshes every five seconds. Measured on production before this route:
 * 69 requests in twelve seconds from one open tab, each around 900ms, the
 * board still filling in ten seconds after the page had painted.
 *
 * The same 23 calls made from here run on the platform's network, in parallel,
 * and the answer is held at the edge for five seconds - so every reader with
 * the page open shares one fan-out instead of each paying for their own. The
 * browser makes one request and parses one payload.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get("d");
  if (!d || !/^\d{8}$/.test(d)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  const date = seoulDay(
    Number(d.slice(0, 4)),
    Number(d.slice(4, 6)),
    Number(d.slice(6, 8)),
  );
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }

  try {
    const matches = await matchesOn(date);
    return NextResponse.json(matches, {
      headers: {
        // Five seconds is the polling interval: one upstream fan-out per
        // interval, however many people are watching.
        "cache-control":
          "public, max-age=0, s-maxage=5, stale-while-revalidate=10",
      },
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }
}
