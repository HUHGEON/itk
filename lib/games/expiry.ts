/**
 * The Heatmap forgets its records once the site has been closed for five
 * minutes.
 *
 * A page cannot tell that the browser was quit - there is no event for it, and
 * sessionStorage only follows a tab. So every open page of the site stamps the
 * time now and then (see Heartbeat), and the next visit clears the Heatmap if
 * the last stamp is older than five minutes: quit the browser, or close every
 * ITK+ tab, and five minutes later it starts clean.
 */
export const ALIVE_KEY = "itk:alive";
export const FORGET_AFTER_MS = 5 * 60_000;

/** Clears the Heatmap if the site has been gone too long, then stamps now. Idempotent. */
export function sweep(now = Date.now()) {
  try {
    const last = Number(localStorage.getItem(ALIVE_KEY) ?? 0);
    if (last && now - last > FORGET_AFTER_MS) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("itk:heatmap:") || k === "itk:stats:heatmap")) localStorage.removeItem(k);
      }
    }
    localStorage.setItem(ALIVE_KEY, String(now));
  } catch {
    // storage blocked: nothing kept, nothing to clear
  }
}

export function stamp() {
  try {
    localStorage.setItem(ALIVE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}
