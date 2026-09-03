"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { collect } from "@/lib/collect";
import { rpc } from "@/lib/supabase";
import { FEED_TAG } from "@/lib/feed";

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
    // The feed moved to /feed when the landing took the root, and this was
    // still clearing the old path - so a manual collection inserted rows that
    // the page then declined to show. The tag covers every cached query at
    // once, whatever route happens to be reading them.
    revalidateTag(FEED_TAG);
    revalidatePath("/feed");
    revalidatePath("/");
    return { ok: true, inserted: stats.inserted, seen: stats.itemsSeen };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Discord destination as listed in the UI — carries no part of the webhook. */
export interface Subscription {
  id: string;
  label: string;
  teams: string[];
  maxTier: number;
  active: boolean;
  /** whether a passphrase was set, so the UI can say so without revealing it */
  hasPass: boolean;
  lastSentAt: string | null;
}

/** One destination in full. Fetched only when the edit screen opens. */
export interface SubscriptionDetail {
  id: string;
  label: string;
  webhookUrl: string;
  teams: string[];
  maxTier: number;
  hasPass: boolean;
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
      id: string; label: string; teams: string[]; max_tier: number;
      active: boolean; has_pass: boolean; last_sent_at: string | null;
    }[]
  >("itk_list_subscriptions", { p_owner: owner });

  return (rows ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    teams: r.teams ?? [],
    maxTier: r.max_tier,
    active: r.active,
    hasPass: Boolean(r.has_pass),
    lastSentAt: r.last_sent_at,
  }));
}

/** The webhook leaves the server only for the owner, and only to be edited. */
export async function getSubscription(
  owner: string,
  id: string,
  /** the destination's own passphrase, required once one has been set */
  auth?: string,
): Promise<SubscriptionDetail | { error: string } | null> {
  if (!owner || owner.length < 16) return null;
  let rows;
  try {
    rows = await rpc<
      {
        id: string; label: string; webhook_url: string;
        teams: string[]; max_tier: number; has_pass: boolean;
      }[]
    >("itk_get_subscription", { p_owner: owner, p_id: id, p_auth: auth || null });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { error: raw.replace(/^itk_get_subscription 실패: /, "") };
  }

  const r = rows?.[0];
  if (!r) return null;
  return {
    id: r.id,
    label: r.label,
    webhookUrl: r.webhook_url,
    teams: r.teams ?? [],
    maxTier: r.max_tier,
    hasPass: Boolean(r.has_pass),
  };
}

export async function updateSubscription(input: {
  owner: string;
  id: string;
  url: string;
  teams: string[];
  maxTier: number;
  label: string;
  /** blank leaves the existing passphrase in place */
  passphrase?: string;
  /** the existing passphrase, required once one has been set */
  auth?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await rpc("itk_update_subscription", {
      p_owner: input.owner,
      p_id: input.id,
      p_url: input.url.trim(),
      p_teams: input.teams,
      p_max_tier: input.maxTier,
      p_label: input.label.trim(),
      p_pass: input.passphrase?.trim() || null,
      p_auth: input.auth?.trim() || null,
    });
    revalidateTag(FEED_TAG);
    revalidatePath("/feed");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: raw.replace(/^itk_update_subscription 실패: /, "") };
  }
}

export async function addSubscription(input: {
  owner: string;
  url: string;
  teams: string[];
  maxTier: number;
  label: string;
  /** optional; set one to manage this destination from another device */
  passphrase?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await rpc<string>("itk_add_subscription", {
      p_owner: input.owner,
      p_url: input.url.trim(),
      p_teams: input.teams,
      p_max_tier: input.maxTier,
      p_label: input.label.trim(),
      p_pass: input.passphrase?.trim() || null,
    });
    revalidateTag(FEED_TAG);
    revalidatePath("/feed");
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
  /** the destination's own passphrase, required once one has been set */
  auth?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const n = await rpc<number>("itk_remove_subscription", {
      p_owner: owner,
      p_id: id,
      p_auth: auth || null,
    });
    revalidateTag(FEED_TAG);
    revalidatePath("/feed");
    revalidatePath("/");
    return n > 0 ? { ok: true } : { ok: false, error: "삭제할 알림을 찾을 수 없습니다" };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: raw.replace(/^itk_remove_subscription 실패: /, "") };
  }
}

/** Re-attaches passphrase-protected destinations to this browser. */
export async function claimSubscriptions(
  owner: string,
  passphrase: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const n = await rpc<number>("itk_claim_subscriptions", {
      p_owner: owner,
      p_pass: passphrase.trim(),
    });
    revalidateTag(FEED_TAG);
    revalidatePath("/feed");
    revalidatePath("/");
    return { ok: true, count: n ?? 0 };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: raw.replace(/^itk_claim_subscriptions 실패: /, "") };
  }
}
