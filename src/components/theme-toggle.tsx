"use client";

import { useSyncExternalStore } from "react";

import { THEME_KEY as KEY } from "@/lib/theme";

type Theme = "system" | "light" | "dark";
const EVENT = "sumo-hub:theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };
const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

function read(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

function apply(t: Theme) {
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Cycles Auto (follow OS) → Light → Dark. */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, read, () => "system");
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => apply(next)}
      className="flex h-10 shrink-0 items-center gap-1 rounded-pill border border-line px-3 text-caption font-bold"
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[theme]}`}
    >
      <span aria-hidden>{ICON[theme]}</span> {LABEL[theme]}
    </button>
  );
}
