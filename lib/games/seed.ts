/**
 * Daily puzzles, the same for everyone in Korea on the same day.
 *
 * A puzzle turns over at midnight in Seoul, not at midnight wherever the
 * reader's clock happens to be, and it is numbered from the day the games
 * launched so a result can say "#12".
 */
const LAUNCH = Date.UTC(2026, 8, 29); // 2026-09-29, Seoul

/** Days since launch, counted on the Korean calendar. */
export function dayNumber(now = Date.now()): number {
  const seoul = now + 9 * 3600_000;
  const day = Math.floor(seoul / 86_400_000) * 86_400_000;
  return Math.floor((day - LAUNCH) / 86_400_000) + 1;
}

/** mulberry32: small, fast, and identical in every browser. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The answer for day `n` out of a pool.
 *
 * The pool is shuffled once with a fixed seed and walked in order, so no answer
 * repeats until every one has been used - picking a fresh random index each day
 * would repeat within weeks.
 */
export function daily<T>(pool: T[], n: number, salt: number): T {
  const order = shuffle(pool, rng(salt));
  return order[((n % order.length) + order.length) % order.length];
}
