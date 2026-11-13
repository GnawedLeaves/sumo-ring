"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (a caching worker would fight hot reload in dev). */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // A worker left over from a `next start` run on this origin would serve stale dev chunks
      // (hydration mismatches against freshly edited code), so remove it in dev.
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Registration failure just means no offline support.
    });
  }, []);
  return null;
}
