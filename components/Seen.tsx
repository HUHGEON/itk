"use client";

import { useEffect } from "react";

/**
 * Remembers that this browser has been here.
 *
 * A cookie rather than localStorage, because the decision it feeds - whether
 * the root shows the introduction or the feed - is made in middleware, before
 * any of this page's JavaScript exists. A flag the server cannot read would
 * mean rendering the introduction and then replacing it, which is the flash
 * this exists to avoid.
 *
 * It carries no identifier and no state beyond having been set.
 */
export function Seen() {
  useEffect(() => {
    if (document.cookie.includes("itk_seen=")) return;
    document.cookie = "itk_seen=1; path=/; max-age=31536000; samesite=lax";
  }, []);

  return null;
}
