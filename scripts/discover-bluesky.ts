/**
 * Finds each journalist's Bluesky account and writes it into the registry.
 *
 * Bluesky is the one place these reporters post primary-source breaking news
 * that we can read for free: `public.api.bsky.app` needs no key, no login and
 * no scraping, unlike X (paid per read) or Instagram (no public read at all).
 *
 *   npm run bluesky              -- 1.5티어 이하 탐색
 *   npm run bluesky -- --tier 0  -- 0티어만
 *   npm run bluesky -- --dry     -- 파일에 쓰지 않고 후보만 출력
 *
 * Impersonators are common, so a handle is only accepted when the display name
 * matches, the account has posted recently, and it has a real following.
 * Everything else is printed for you to judge.
 */
import "../lib/load-env";
import fs from "node:fs";
import path from "node:path";
import type { Journalist } from "../lib/types";

const API = "https://public.api.bsky.app/xrpc";
const REGISTRY = path.join(process.cwd(), "data", "journalists.json");

const MIN_FOLLOWERS = 400;
const MAX_QUIET_DAYS = 60;
const GAP_MS = 250;

interface Actor {
  handle: string;
  displayName?: string;
  description?: string;
  followersCount?: number;
  postsCount?: number;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function api<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  const url = `${API}/${endpoint}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Football bios help separate the reporter from same-named strangers. */
const FOOTBALL_HINT =
  /football|soccer|transfer|reporter|journalist|correspondent|sport|calcio|fútbol|futbol|fussball|voetbal|bbc|sky|athletic|espn|kicker|marca/i;

interface Verdict {
  handle: string;
  followers: number;
  posts: number;
  latest: string;
  accepted: boolean;
  why: string;
}

async function evaluate(j: Journalist, actor: Actor): Promise<Verdict | null> {
  const profile = await api<Actor>("app.bsky.actor.getProfile", { actor: actor.handle });
  if (!profile) return null;

  const feed = await api<{ feed: { post: { record: { createdAt?: string } } }[] }>(
    "app.bsky.feed.getAuthorFeed",
    { actor: actor.handle, limit: "20" },
  );

  const dates = (feed?.feed ?? [])
    .map((p) => p.post.record.createdAt ?? "")
    .filter(Boolean)
    .sort();
  const latest = dates.at(-1) ?? "";
  const quietDays = latest
    ? Math.floor((Date.now() - Date.parse(latest)) / 86_400_000)
    : Infinity;

  const followers = profile.followersCount ?? 0;
  const nameMatches = norm(profile.displayName ?? "") === norm(j.en);
  const bio = `${profile.description ?? ""}`;

  const reasons: string[] = [];
  if (!nameMatches) reasons.push("이름 불일치");
  if (followers < MIN_FOLLOWERS) reasons.push(`팔로워 ${followers}`);
  if (quietDays > MAX_QUIET_DAYS) reasons.push(`${quietDays === Infinity ? "게시물 없음" : `${quietDays}일 휴면`}`);
  if (!FOOTBALL_HINT.test(bio)) reasons.push("축구 관련 소개 없음");

  // The bio check alone shouldn't disqualify an otherwise strong match.
  const accepted =
    nameMatches && followers >= MIN_FOLLOWERS && quietDays <= MAX_QUIET_DAYS;

  return {
    handle: profile.handle,
    followers,
    posts: profile.postsCount ?? 0,
    latest: latest.slice(0, 10),
    accepted,
    why: reasons.join(", ") || "조건 충족",
  };
}

async function main() {
  const maxTier = arg("tier") ? Number(arg("tier")) : 1.5;
  const dry = process.argv.includes("--dry");

  const journalists = JSON.parse(fs.readFileSync(REGISTRY, "utf8")) as Journalist[];
  const targets = journalists.filter((j) => j.active && j.tier <= maxTier);

  console.log(`${targets.length}명 탐색 (${maxTier}티어 이하)\n`);

  let found = 0;
  const unsure: string[] = [];

  for (const j of targets) {
    await sleep(GAP_MS);
    const search = await api<{ actors: Actor[] }>("app.bsky.actor.searchActors", {
      term: j.en,
      limit: "5",
    });
    const actors = search?.actors ?? [];
    if (actors.length === 0) continue;

    // Only bother verifying candidates whose display name looks right.
    const plausible = actors.filter((a) => norm(a.displayName ?? "") === norm(j.en));
    if (plausible.length === 0) continue;

    let best: Verdict | null = null;
    for (const a of plausible.slice(0, 3)) {
      await sleep(GAP_MS);
      const v = await evaluate(j, a);
      if (!v) continue;
      if (!best || v.followers > best.followers) best = v;
    }
    if (!best) continue;

    if (best.accepted) {
      j.bluesky = best.handle;
      found++;
      console.log(
        `✓ ${j.ko.padEnd(14)} @${best.handle.padEnd(32)} ` +
          `팔로워 ${best.followers.toLocaleString().padStart(8)} · 최신 ${best.latest}`,
      );
    } else {
      unsure.push(`  ? ${j.ko.padEnd(14)} @${best.handle} — ${best.why}`);
    }
  }

  if (!dry) {
    fs.writeFileSync(REGISTRY, JSON.stringify(journalists, null, 2) + "\n");
  }

  console.log(`\n=== 확정 ${found}명${dry ? " (dry run — 저장 안 함)" : " 저장 완료"} ===`);
  if (unsure.length > 0) {
    console.log(`\n보류 ${unsure.length}건 (직접 확인 후 journalists.json의 "bluesky"에 추가):`);
    console.log(unsure.join("\n"));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
