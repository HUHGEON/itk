import { NextResponse } from "next/server";
import { fotmobPlayer } from "@/lib/fotmob";

/**
 * One player, for the panel that opens over a lineup.
 *
 * The panel is opened by a click rather than a navigation, so the data has to
 * reach the browser after the page has rendered - which needs a route of its
 * own. The upstream answer is already cached for an hour, so this is a cheap
 * call the second time anyone asks about the same player.
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
  const player = await fotmobPlayer(n);
  if (!player) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(player, {
    headers: { "cache-control": "public, max-age=600, s-maxage=3600" },
  });
}
