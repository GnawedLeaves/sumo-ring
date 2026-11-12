"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `loadMore` when the returned sentinel element scrolls within `margin` of the viewport.
 * Put the sentinel after the last list item. Pass `enabled: false` when done, loading or errored.
 */
export function useInfiniteScroll(loadMore: () => void, enabled: boolean, margin = "300px") {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, enabled, margin]);
  return ref;
}
