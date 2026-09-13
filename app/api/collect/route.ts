import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { collect } from "@/lib/collect";
import { FEED_TAG } from "@/lib/feed";

/**
 * Collect on demand, from the button in the rail.
 *
 * This was a Server Action, which is the reason it felt like the site had
 * seized. Actions and navigations share one queue in the App Router, so for as
 * long as the run was in flight nothing else could move: measured on
 * production, a filter clicked four seconds into a collection did not land for
 * **16.7 more seconds** - it sat there until the collection finished. The page
 * itself was fine the whole time (opening an article row took 30ms, no long
 * tasks at all); it was only the router that was stuck behind the action.
 *
 * A plain request is not in that queue, so pressing 수집 now costs nothing but
 * the button, and the rest of the page keeps working while it runs.
 *
 * It went to an action in the first place because the old `/api/collect` was
 * callable by anyone, and a run fans out to about ninety sources and writes
 * with the service key. That is answered here instead, and more strictly than
 * before: the request has to come from a page on this site, and no instance
 * will start a second run inside a minute however many times it is asked.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Held per instance rather than in the database.
 *
 * What it has to stop is one client hammering the button, and that client
 * lands on one instance. A shared counter would mean a round trip on the way
 * in to guard against something a round trip already costs more than.
 */
let lastRun = 0;
const COOLDOWN_MS = 60_000;

export async function POST(req: Request) {
  /*
   * Sent by the browser, and not settable by a page on another origin - which
   * is the whole check. A request with no `Sec-Fetch-Site` at all is not a
   * browser making a same-origin call, so it is refused too.
   */
  if (req.headers.get("sec-fetch-site") !== "same-origin") {
    return NextResponse.json({ ok: false, error: "same-origin only" }, { status: 403 });
  }

  const since = Date.now() - lastRun;
  if (since < COOLDOWN_MS) {
    return NextResponse.json(
      {
        ok: false,
        error: `${Math.ceil((COOLDOWN_MS - since) / 1000)}초 뒤에 다시 시도하세요`,
      },
      { status: 429 },
    );
  }
  lastRun = Date.now();

  try {
    // Tier 0 plus the outlet feeds. The wide passes belong to the scheduled
    // job, which has no one waiting on it.
    const stats = await collect({ maxTier: 0 });
    // The tag covers every cached query at once, whatever route is reading it.
    revalidateTag(FEED_TAG);
    revalidatePath("/feed");
    return NextResponse.json({
      ok: true,
      inserted: stats.inserted,
      seen: stats.itemsSeen,
    });
  } catch (err) {
    // A failed run must not lock the button out for a minute.
    lastRun = 0;
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
