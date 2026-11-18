import { Check } from "lucide-react";
import Link from "next/link";
import { LiveIndicator } from "@/components/live-indicator";
import type { DayStatus } from "@/lib/live";
import { ScrollToCurrent } from "./scroll-to-current";

const DAYS = Array.from({ length: 15 }, (_, i) => i + 1);

const LABEL: Record<DayStatus, string> = { done: "completed", live: "live now", today: "today", upcoming: "upcoming" };

/**
 * Day 1–15 buttons. Each day shows its state: completed (tick), live now (red dot, outlined), today before the
 * session starts (outlined), upcoming (dashed, muted). The selected day is filled.
 */
export function DayPicker({
  selected,
  statusOf,
  hrefFor,
  vertical = false,
}: {
  selected: number;
  statusOf: (day: number) => DayStatus;
  hrefFor: (day: number) => string;
  /** Column on desktop (basho page sidebar) instead of a single scrolling row. */
  vertical?: boolean;
}) {
  return (
    // Scrolls the row to the selected day (today's live day by default), so it's in view without hunting for it.
    <ScrollToCurrent
      currentKey={selected}
      label="Day"
      className={
        vertical
          ? "flex gap-1 self-start overflow-x-auto md:sticky md:top-20 md:max-h-[calc(100dvh-6rem)] md:flex-col md:overflow-y-auto md:overflow-x-visible"
          : "-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      }
    >
      {DAYS.map((d) => {
        const status = statusOf(d);
        const isSel = d === selected;
        const look = isSel
          ? "border-indigo-frame bg-indigo-frame text-white"
          : status === "live"
            ? "border-2 border-crimson-spotlight bg-surface text-brand"
            : status === "today"
              ? "border-2 border-brand bg-surface text-brand"
              : status === "upcoming"
                ? "border-dashed border-line bg-transparent text-ink-soft hover:bg-hover"
                : "border-line bg-surface text-ink hover:bg-hover";
        return (
          <Link
            key={d}
            href={hrefFor(d)}
            scroll={false}
            aria-current={isSel ? "page" : undefined}
            aria-label={`Day ${d}, ${LABEL[status]}`}
            title={`Day ${d} · ${LABEL[status]}`}
            className={`flex shrink-0 items-center justify-center gap-1.5 border px-3 py-2 text-body-sm font-bold whitespace-nowrap ${look}`}
          >
            {status === "live" && <LiveIndicator />}
            Day {d}
            {status === "done" && <Check aria-hidden className={`h-3.5 w-3.5 ${isSel ? "" : "text-ink-soft"}`} strokeWidth={2.5} />}
          </Link>
        );
      })}
    </ScrollToCurrent>
  );
}
