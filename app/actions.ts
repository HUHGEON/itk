"use server";

import { revalidatePath } from "next/cache";
import { collect } from "@/lib/collect";

/**
 * Collect on demand, from the button in the header.
 *
 * A Server Action rather than a route handler: the previous `/api/collect`
 * endpoint was reachable by anyone, and each call fans out ~50 outbound
 * requests, writes with the service_role key and runs the pruner. Next.js
 * validates the action's origin, so this can't be driven from off-site.
 *
 * Scope stays at tier 0 plus the outlet feeds (~30s) — Vercel's Hobby plan
 * caps a function at 60s, and the wide passes belong to the scheduled job.
 */
export async function collectNow(): Promise<
  { ok: true; inserted: number; seen: number } | { ok: false; error: string }
> {
  try {
    const stats = await collect({ maxTier: 0 });
    revalidatePath("/");
    return { ok: true, inserted: stats.inserted, seen: stats.itemsSeen };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
