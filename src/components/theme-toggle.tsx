"use client";

import { useEffect, useSyncExternalStore } from "react";

import { THEME_COOKIE, THEME_KEY as KEY } from "@/lib/theme";

type Theme = "system" | "light" | "dark";
const EVENT = "sumo-hub:theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };
const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

function read(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

/** The saved choice: localStorage first, cookie as a fallback. */
function stored(): Theme {
  let t: string | null = null;
  try {
    t = localStorage.getItem(KEY);
  } catch {}
  if (t !== "light" && t !== "dark") t = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`))?.[1] ?? null;
  return t === "light" || t === "dark" ? t : "system";
}

function setAttr(t: Theme) {
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

function apply(t: Theme) {
  setAttr(t);
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  document.cookie =
    t === "system" ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax` : `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Cycles Auto (follow OS) → Light → Dark. */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, read, () => "system");
  // Safety net: if anything cleared the attribute after the head script ran, restore the saved choice.
  useEffect(() => {
    const saved = stored();
    if (saved !== read()) {
      setAttr(saved);
      window.dispatchEvent(new Event(EVENT));
    }
  }, []);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => apply(next)}
      className="flex h-10 shrink-0 items-center gap-1 rounded-pill border border-line px-3 text-caption font-bold"
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[theme]}`}
    >
      <span aria-hidden>{ICON[theme]}</span> <span className="hidden sm:inline">{LABEL[theme]}</span>
    </button>
  );
}
