"use client";

const STORAGE_KEY = "itk:owner";

/**
 * A random token identifying this browser as the owner of the Discord
 * destinations it registers.
 *
 * The site is public and has no accounts, so without something like this every
 * visitor could read and delete everyone else's webhooks. It is deliberately
 * not an account: the tradeoff is that clearing site data, or opening the site
 * on another device, hides the list (alerts keep being delivered — only the
 * management view is gated).
 */
export function ownerKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 16) return existing;

    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    window.localStorage.setItem(STORAGE_KEY, key);
    return key;
  } catch {
    // Private browsing: registration will fail with a clear message rather
    // than silently creating a destination nobody can manage.
    return "";
  }
}
