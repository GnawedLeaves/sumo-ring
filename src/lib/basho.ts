// Basho calendar helpers. Pure functions so they can run on server and client.
//
// Honbasho are held in odd months and start on the second Sunday, running 15 days.
// The API's startDate/endDate should be preferred when available; this rule is the fallback
// for future basho the API doesn't know about yet.

export const BASHO_NAMES: Record<number, { en: string; jp: string; venue: string; city: string }> = {
  1: { en: "Hatsu", jp: "初場所", venue: "Ryōgoku Kokugikan", city: "Tokyo" },
  3: { en: "Haru", jp: "春場所", venue: "EDION Arena Osaka", city: "Osaka" },
  5: { en: "Natsu", jp: "夏場所", venue: "Ryōgoku Kokugikan", city: "Tokyo" },
  7: { en: "Nagoya", jp: "名古屋場所", venue: "IG Arena", city: "Nagoya" },
  9: { en: "Aki", jp: "秋場所", venue: "Ryōgoku Kokugikan", city: "Tokyo" },
  11: { en: "Kyushu", jp: "九州場所", venue: "Fukuoka Kokusai Center", city: "Fukuoka" },
};

const DAY_MS = 86_400_000;
const JST_OFFSET_MS = 9 * 3_600_000;

export function bashoId(year: number, month: number) {
  return `${year}${String(month).padStart(2, "0")}`;
}

export function parseBashoId(id: string) {
  return { year: Number(id.slice(0, 4)), month: Number(id.slice(4, 6)) };
}

export function bashoName(id: string) {
  const { year, month } = parseBashoId(id);
  const info = BASHO_NAMES[month];
  return info ? `${info.en} ${year}` : id;
}

export function bashoInfo(id: string) {
  return BASHO_NAMES[parseBashoId(id).month];
}

/** e.g. "Kyushu Basho 2026 Day 6: Fujinokawa vs Ura" (east first, as on the torikumi). Used for copy/share captions. */
export function boutTitle(bashoId: string, day: number, east: string, west: string) {
  const info = bashoInfo(bashoId);
  return `${info ? `${info.en} Basho ${bashoId.slice(0, 4)}` : bashoName(bashoId)} Day ${day}: ${east} vs ${west}`;
}

/** Start of day 1 as a UTC timestamp at JST midnight. */
export function ruleStartDate(id: string): Date {
  const { year, month } = parseBashoId(id);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
  return new Date(Date.UTC(year, month - 1, firstSunday + 7) - JST_OFFSET_MS);
}

/** Normalises an API date like "2026-11-08T00:00:00Z" (a calendar date) to JST midnight. */
export function apiDateToJst(date: string): Date {
  return new Date(new Date(date).getTime() - JST_OFFSET_MS);
}

export type BashoWindow = { id: string; start: Date; end: Date };

export function bashoWindow(id: string, apiStart?: string): BashoWindow {
  const start = apiStart ? apiDateToJst(apiStart) : ruleStartDate(id);
  return { id, start, end: new Date(start.getTime() + 15 * DAY_MS) };
}

/** Basho ids from `fromId` onwards (inclusive), `count` of them. */
export function nextBashoIds(fromId: string, count: number): string[] {
  let { year, month } = parseBashoId(fromId);
  if (month % 2 === 0) month += 1;
  const ids: string[] = [];
  while (ids.length < count) {
    if (month > 12) {
      month = 1;
      year += 1;
    }
    ids.push(bashoId(year, month));
    month += 2;
  }
  return ids;
}

/** Basho ids before `fromId` (exclusive), most recent first. */
export function previousBashoIds(fromId: string, count: number): string[] {
  let { year, month } = parseBashoId(fromId);
  const ids: string[] = [];
  while (ids.length < count) {
    month -= month % 2 === 0 ? 1 : 2;
    if (month < 1) {
      month += 12;
      year -= 1;
    }
    ids.push(bashoId(year, month));
  }
  return ids;
}

/** The basho running at `now`, if any, otherwise null. Uses the date rule. */
export function activeBashoAt(now: Date): BashoWindow | null {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const id = bashoId(jst.getUTCFullYear(), jst.getUTCMonth() + 1);
  if (jst.getUTCMonth() % 2 !== 0) return null; // even calendar month -> no basho
  const w = bashoWindow(id);
  return now >= w.start && now < w.end ? w : null;
}

/** Current day number (1–15) for a window, or null when outside it. */
export function dayOf(window: BashoWindow, now: Date): number | null {
  const day = Math.floor((now.getTime() - window.start.getTime()) / DAY_MS) + 1;
  return day >= 1 && day <= 15 ? day : null;
}

/** Most recent basho whose start date is on or before `now` (may still be in progress). */
export function latestStartedBashoId(now: Date): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  let year = jst.getUTCFullYear();
  let month = jst.getUTCMonth() + 1;
  if (month % 2 === 0) month -= 1;
  const candidate = bashoId(year, month);
  if (ruleStartDate(candidate) <= now) return candidate;
  month -= 2;
  if (month < 1) {
    month += 12;
    year -= 1;
  }
  return bashoId(year, month);
}

export function formatDateRange(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Tokyo" });
  const last = new Date(end.getTime() - DAY_MS);
  return `${fmt.format(start)} – ${fmt.format(last)} ${last.toLocaleString("en-GB", { year: "numeric", timeZone: "Asia/Tokyo" })}`;
}
