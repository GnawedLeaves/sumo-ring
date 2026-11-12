"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (a caching worker would fight hot reload in dev). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Registration failure just means no offline support.
    });
  }, []);
  return null;
}
