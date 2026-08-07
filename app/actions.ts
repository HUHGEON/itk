"use server";

import { revalidatePath } from "next/cache";
import { collect } from "@/lib/collect";
import { rpc } from "@/lib/supabase";

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

/** Discord destination as shown in the UI — never the full webhook URL. */
export interface Subscription {
  id: string;
  label: string;
  hint: string;
  teams: string[];
  maxTier: number;
  active: boolean;
  lastSentAt: string | null;
}

/**
 * `owner` is a random token the browser keeps in localStorage. It stands in for
 * an account: the site is public, and without it every visitor could read and
 * delete everyone else's destinations.
 */
export async function listSubscriptions(owner: string): Promise<Subscription[]> {
  if (!owner || owner.length < 16) return [];
  const rows = await rpc<
    {
      id: string; label: string; hint: string; teams: string[];
      max_tier: number; active: boolean; last_sent_at: string | null;
    }[]
  >("itk_list_subscriptions", { p_owner: owner });

  return (rows ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    hint: r.hint,
    teams: r.teams ?? [],
    maxTier: r.max_tier,
    active: r.active,
    lastSentAt: r.last_sent_at,
  }));
}

export async function addSubscription(input: {
  owner: string;
  url: string;
  teams: string[];
  maxTier: number;
  label: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await rpc<string>("itk_add_subscription", {
      p_owner: input.owner,
      p_url: input.url.trim(),
      p_teams: input.teams,
      p_max_tier: input.maxTier,
      p_label: input.label.trim(),
    });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    // The database enforces the Discord host and the team requirement, so its
    // message is the one worth showing.
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: raw.replace(/^itk_add_subscription 실패: /, "") };
  }
}

export async function removeSubscription(
  owner: string,
  id: string,
): Promise<{ ok: boolean }> {
  const n = await rpc<number>("itk_remove_subscription", { p_owner: owner, p_id: id });
  revalidatePath("/");
  return { ok: n > 0 };
}
