"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches server components on an interval (for live torikumi). Pauses while the tab is hidden. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      router.refresh();
    };
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, seconds * 1000);
    // Back on the tab after missing a refresh: catch up straight away instead of waiting for the next tick.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > seconds * 1000) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);
  return null;
}
