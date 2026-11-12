// Per-browser rikishi search history (spec §2 / §4.1). localStorage only — never sent to the server.

export type HistoryItem = { q: string; id?: number; en?: string; jp?: string; at: number };

const KEY = "sumo-hub:rikishi-searches";
const MAX = 10;
const EVENT = "sumo-hub:history";

export function readHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

function write(items: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage full / disabled — history is a nicety, ignore
  }
}

export function pushHistory(item: Omit<HistoryItem, "at">) {
  const key = (i: Omit<HistoryItem, "at">) => (i.id ? `id:${i.id}` : `q:${i.q.toLowerCase()}`);
  const next = [{ ...item, at: Date.now() }, ...readHistory().filter((h) => key(h) !== key(item))].slice(0, MAX);
  write(next);
}

export function clearHistory() {
  write([]);
}

export function subscribeHistory(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Stable snapshot for useSyncExternalStore. */
let cache: { raw: string | null; items: HistoryItem[] } = { raw: null, items: [] };
export function historySnapshot(): HistoryItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cache.raw) cache = { raw, items: readHistory() };
  return cache.items;
}
const EMPTY: HistoryItem[] = [];
export const serverHistorySnapshot = () => EMPTY;
