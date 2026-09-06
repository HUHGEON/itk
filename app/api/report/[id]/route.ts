import { NextResponse } from "next/server";
import { fotmobReportById } from "@/lib/fotmob";

/**
 * A match report, for the page to poll while the match is being played.
 *
 * The ratings, the timeline and the statistics all move during a match, and the
 * page is rendered once - so without this the report a reader opened at
 * kick-off would still show an empty timeline at full time. The upstream holds
 * a live match for ten seconds, which is what this passes on.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const report = await fotmobReportById(n);
  if (!report) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(report, {
    headers: { "cache-control": "public, max-age=10, s-maxage=10" },
  });
}
