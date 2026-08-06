import { NextResponse } from "next/server";
import { collect } from "@/lib/collect";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Collect on demand, from the button in the header.
 *
 * A full pass over 244 journalists takes a couple of minutes, well past a
 * serverless timeout — so the default here is the "hot" band (tier 0 plus the
 * outlet feeds, ~30s). `?tier=` widens it when you're willing to wait.
 */
export async function POST(req: Request) {
  const secret = process.env.COLLECT_SECRET;
  if (secret && req.headers.get("x-collect-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const tier = Number(url.searchParams.get("tier"));

  try {
    const stats = await collect({
      maxTier: Number.isFinite(tier) ? tier : 0,
      skipOutlets: url.searchParams.get("outlets") === "0",
    });

    return NextResponse.json({
      ok: true,
      inserted: stats.inserted,
      seen: stats.itemsSeen,
      failed: stats.failed,
      notModified: stats.notModified,
      durationMs: stats.durationMs,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
