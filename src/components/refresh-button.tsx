"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Small button that re-fetches the page's server data (e.g. which bout is on the dohyō) without a reload. */
export function RefreshButton({ label = "Refresh" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-body-sm hover:bg-hover disabled:opacity-60"
    >
      <span aria-hidden className={pending ? "animate-spin motion-reduce:animate-none" : ""}>
        ↻
      </span>
    </button>
  );
}
