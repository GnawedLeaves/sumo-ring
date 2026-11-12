"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BASHO_NAMES, bashoId, bashoWindow, formatDateRange, latestStartedBashoId, nextBashoIds, parseBashoId } from "@/lib/basho";

// One shared 1-second clock for every countdown on the page.
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const getNow = () => now || Date.now();
const getServerNow = () => 0;

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Upcoming basho with live countdowns + a year-at-a-glance grid. Rendered client-side because it depends on "now". */
export function BashoCalendar({ apiStarts }: { apiStarts: Record<string, string> }) {
  const t = useSyncExternalStore(subscribe, getNow, getServerNow);
  if (!t) return <p className="text-body-sm">Loading calendar…</p>;

  const current = new Date(t);
  const latest = latestStartedBashoId(current);
  const latestWindow = bashoWindow(latest, apiStarts[latest]);
  const running = current < latestWindow.end ? latestWindow : null;
  const upcoming = nextBashoIds(latest, 7)
    .slice(1)
    .map((id) => bashoWindow(id, apiStarts[id]));
  const [next, ...later] = upcoming;
  const nextLeft = split(next.start.getTime() - t);
  const year = current.getFullYear();

  return (
    <div className="flex flex-col gap-16">
      {running && (
        <Link href="/basho" className="flex flex-col gap-2 bg-crimson-spotlight p-6 text-white md:p-10">
          <span className="badge self-start">IN PROGRESS</span>
          <span className="font-display text-heading sm:text-heading-lg font-bold">{name(running.id)}</span>
          <span className="text-body">
            Day {Math.floor((t - running.start.getTime()) / 86_400_000) + 1} of 15 · ends in {split(running.end.getTime() - t).d} days. Follow live →
          </span>
        </Link>
      )}

      {/* Next basho hero countdown */}
      <section className="flex flex-col items-center gap-6 text-center">
        <p className="text-caption font-bold uppercase tracking-wide text-ink-soft">Next basho</p>
        <h2 className="font-display text-heading sm:text-heading-lg font-bold text-brand md:text-display">{name(next.id)}</h2>
        <p className="text-body">
          {formatDateRange(next.start, next.end)} · {info(next.id).venue}, {info(next.id).city}
        </p>
        <div className="grid w-full max-w-md grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off">
          {(
            [
              ["days", nextLeft.d],
              ["hours", nextLeft.h],
              ["min", nextLeft.m],
              ["sec", nextLeft.s],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="flex min-w-0 flex-col border border-line bg-surface px-1 py-3 sm:px-4">
              <span className="font-display text-subheading font-bold tabular-nums text-brand sm:text-heading">{String(v).padStart(2, "0")}</span>
              <span className="text-caption uppercase text-ink-soft">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Following basho */}
      <section className="flex flex-col gap-5">
        <h2 className="text-center font-display text-heading text-brand">Coming up</h2>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {later.map((w, i) => (
            <li key={w.id} className={`${["bg-cobalt-stage", "bg-tangerine-pop", "bg-plum-velvet", "bg-rose-petal", "bg-vermillion"][i % 5]} flex flex-col gap-2 p-5 text-white`}>
              <span className="text-subheading font-bold">{name(w.id)}</span>
              <span className="font-jp text-body-sm">{info(w.id).jp}</span>
              <span className="text-body-sm">{formatDateRange(w.start, w.end)}</span>
              <span className="text-body-sm">{info(w.id).city}</span>
              <span className="mt-auto font-display text-subheading">in {split(w.start.getTime() - t).d} days</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Year at a glance */}
      {[year, year + 1].map((y) => (
        <section key={y} className="flex flex-col gap-5">
          <h2 className="font-display text-heading text-brand">{y}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, m) => (
              <MonthGrid key={m} year={y} month={m + 1} apiStarts={apiStarts} today={current} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function name(id: string) {
  const { year } = parseBashoId(id);
  return `${info(id).en} ${year}`;
}
function info(id: string) {
  return BASHO_NAMES[parseBashoId(id).month];
}

function MonthGrid({ year, month, apiStarts, today }: { year: number; month: number; apiStarts: Record<string, string>; today: Date }) {
  const isBasho = month % 2 === 1;
  const w = isBasho ? bashoWindow(bashoId(year, month), apiStarts[bashoId(year, month)]) : null;
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const inBasho = (d: number) => {
    if (!w) return false;
    // Calendar day d in JST, compared at JST noon
    const ts = Date.UTC(year, month - 1, d, 3);
    return ts >= w.start.getTime() && ts < w.end.getTime();
  };
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === d;

  return (
    <div className={`border border-line p-3 ${isBasho ? "bg-surface" : "bg-canvas"}`}>
      <p className="mb-2 flex items-baseline justify-between text-body-sm font-bold">
        {first.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })}
        {isBasho && <span className="text-caption font-normal text-vermillion">{BASHO_NAMES[month].en}</span>}
      </p>
      <div className="grid grid-cols-7 gap-px text-center text-caption">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-ink-soft">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
          <span
            key={d}
            className={`py-0.5 ${inBasho(d) ? "bg-indigo-frame font-bold text-white" : ""} ${isToday(d) ? "outline-2 outline-tangerine-pop" : ""}`}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
