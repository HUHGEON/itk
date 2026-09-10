import { NextResponse } from "next/server";

/**
 * A way through to the fixture source when the browser cannot reach it.
 *
 * Live scores are polled straight from the visitor's browser, which is what
 * makes a ticking scoreline cost this project nothing. That works because the
 * source answers with CORS open - but it does not always answer. Measured from
 * one address: the same request returns 200 to a plain client and 403 to
 * anything sending a browser's User-Agent, and a 403 carries no CORS headers,
 * so the page sees it as a network failure and the scoreline simply stops.
 *
 * This is the fallback, used only after a direct call has failed. The server is
 * not subject to the same rule, so the poll continues through here.
 */
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  // Only the two shapes the pages actually ask for, so this cannot be used as
  // an open proxy to anywhere on that host.
  const joined = path.join("/");
  if (!/^[\w.]+\/(scoreboard|summary)$/.test(joined)) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }
  const query = new URL(req.url).searchParams.toString();

  try {
    const res = await fetch(`${ESPN}/${joined}${query ? `?${query}` : ""}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream" }, { status: res.status });
    }
    return NextResponse.json(await res.json(), {
      headers: {
        // A live scoreline: the edge may hold it briefly, the browser may not.
        "cache-control": "public, max-age=0, s-maxage=3, stale-while-revalidate=5",
      },
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }
}
