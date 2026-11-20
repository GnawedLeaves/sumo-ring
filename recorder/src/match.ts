// Finds which bout a clip belongs to, using the day's torikumi from the Sumo API.
const SUMO_API = "https://www.sumo-api.com";

export type Division = "Juryo" | "Makuuchi";
export type Bout = {
  bashoId: string;
  day: number;
  division: Division;
  matchNo: number;
  eastId: number;
  eastShikona: string;
  westId: number;
  westShikona: string;
  /** 0 until decided */
  winnerId: number;
  kimarite: string;
};

/** Same format as the app's boutId() (src/lib/format.ts). */
export const boutIdOf = (b: Bout) => `${b.bashoId}-${b.day}-${b.matchNo}-${b.eastId}-${b.westId}`;

/** Juryo then Makuuchi bouts for a day, in running order. */
export async function dayBouts(bashoId: string, day: number): Promise<Bout[]> {
  const out: Bout[] = [];
  for (const division of ["Juryo", "Makuuchi"] as const) {
    const res = await fetch(`${SUMO_API}/api/basho/${bashoId}/torikumi/${division}/${day}`);
    if (!res.ok) throw new Error(`Sumo API torikumi ${division} day ${day}: HTTP ${res.status}`);
    const json = (await res.json()) as { torikumi?: Omit<Bout, "bashoId" | "day" | "division">[] | null };
    for (const m of json.torikumi ?? []) out.push({ ...m, bashoId, day, division });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");

/** The bout a rikishi fought that day (by English shikona, case/accents ignored). */
export function findByRikishi(bouts: Bout[], name: string): Bout | undefined {
  const n = norm(name);
  return bouts.find((b) => norm(b.eastShikona) === n || norm(b.westShikona) === n);
}

/** Winner side of a decided bout, or null if undecided. */
export const winnerSide = (b: Bout): "east" | "west" | null =>
  b.winnerId === b.eastId ? "east" : b.winnerId === b.westId ? "west" : null;

/** Walkover (no bout is fought, so there's no clip to match). */
const isFusen = (b: Bout) => /fusen/i.test(b.kimarite);

/** Today's basho and day (JST), or null when no basho is running today. */
export async function todaysBashoDay(now = new Date()): Promise<{ bashoId: string; day: number } | null> {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  const today = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  const month = jst.getUTCMonth() + 1;
  if (month % 2 === 0) return null; // basho are in odd months
  const bashoId = `${jst.getUTCFullYear()}${String(month).padStart(2, "0")}`;
  const res = await fetch(`${SUMO_API}/api/basho/${bashoId}`);
  if (!res.ok) return null;
  const { startDate } = (await res.json()) as { startDate?: string };
  if (!startDate) return null;
  const day = Math.round((today - Date.parse(startDate.slice(0, 10))) / 86_400_000) + 1;
  return day >= 1 && day <= 15 ? { bashoId, day } : null;
}

const POLL_MS = 30_000;
/**
 * Live: a bout whose result was already in the Sumo API this long before a clip's signal ended before that clip's
 * bout, so it can't be it (a bout the detector missed). Covers the 30 s poll interval + the graphic's ~5 s lag.
 */
const DECIDED_BEFORE_SLACK_MS = 45_000;
/**
 * Live: a clip's official result must reach the Sumo API within this long of the graphic, or the clip isn't that
 * bout. Measured on Kyushu 2026 day 13: 50-160 s normally, 219 s after a mono-ii. Highlights and replays shown in
 * the break before Makuuchi produced fake results whose "bouts" were only decided 9-13 min later; without this
 * limit they took Makuuchi #1, #2… and every later clip was off by one.
 */
const MAX_RESULT_LAG_MS = 5 * 60_000;
/** Fastest the Sumo API has had a result after the graphic (measured 50 s), minus slack for the 30 s poll. */
const MIN_RESULT_LAG_MS = 30_000;
/** Same as WINDOW.minResultGapSec in bouts.ts: a result this soon after another is that bout again. */
const REPEAT_GAP_MS = 150_000;

/**
 * Assigns each clip, in the order they're cut, to a bout of the day. Keeps a cursor in the running order (Juryo
 * then Makuuchi). For each clip it looks at the next few unmatched bouts and takes the first whose official winner
 * side matches the side the graphic highlighted; bouts it passes over (missed bouts) are skipped, walkovers are
 * always skipped. Live, the official result can lag the broadcast, so it polls the Sumo API until the bout is
 * decided (up to `waitMs`). A rematch clip reuses the previous clip's bout.
 */
export class BoutMatcher {
  private bouts: Bout[] = [];
  private last: Bout | null = null;
  /** Live only: when each bout's result first showed up in the Sumo API (wall clock ms; 0 = before we started). */
  private readonly decidedSeenAt = new Map<string, number>();
  readonly bashoId: string;
  readonly day: number;
  private cursor: number;
  private readonly waitMs: number;

  private constructor(bashoId: string, day: number, cursor: number, waitMs: number) {
    this.bashoId = bashoId;
    this.day = day;
    this.cursor = cursor;
    this.waitMs = waitMs;
  }

  /** Live: today's basho/day, starting at the first bout without a result yet. Null if no basho today. */
  static async live(waitMs = 20 * 60_000): Promise<BoutMatcher | null> {
    const today = await todaysBashoDay();
    if (!today) return null;
    const m = new BoutMatcher(today.bashoId, today.day, 0, waitMs);
    m.bouts = await dayBouts(today.bashoId, today.day);
    for (const b of m.bouts) if (b.winnerId) m.decidedSeenAt.set(boutIdOf(b), 0);
    const first = m.bouts.findIndex((b) => !b.winnerId);
    m.cursor = first < 0 ? m.bouts.length : first;
    // Keep noting when results arrive, so a clip can tell bouts that ended before it from its own.
    setInterval(() => void m.refresh().catch(() => {}), POLL_MS).unref();
    return m;
  }

  private async refresh() {
    this.bouts = await dayBouts(this.bashoId, this.day);
    const now = Date.now();
    for (const b of this.bouts) if (b.winnerId && !this.decidedSeenAt.has(boutIdOf(b))) this.decidedSeenAt.set(boutIdOf(b), now);
  }

  /** Re-run / recording: a past day where every bout is decided, starting at the bout `fromRikishi` fought. */
  static async from(bashoId: string, day: number, fromRikishi: string): Promise<BoutMatcher> {
    const m = new BoutMatcher(bashoId, day, 0, 0);
    m.bouts = await dayBouts(bashoId, day);
    const start = findByRikishi(m.bouts, fromRikishi);
    if (!start) throw new Error(`${fromRikishi} has no bout on day ${day} of ${bashoId}`);
    m.cursor = m.bouts.indexOf(start);
    return m;
  }

  /** Live: seconds between the graphic's result and the result first appearing in the Sumo API (for logs). */
  resultLagSec(b: Bout, signalAt: number | undefined): number | null {
    const seen = this.decidedSeenAt.get(boutIdOf(b));
    return signalAt === undefined || !seen ? null : Math.round((seen - signalAt) / 1000);
  }

  /** The bout the cursor is at (for logs). */
  get next(): Bout | undefined {
    return this.bouts[this.cursor];
  }

  /**
   * `side`: the winner the graphic showed (null for a yellow / unsure result: no side check).
   * `signalAt` (live): wall-clock ms when the graphic showed the result. Bouts already decided well before it
   * are skipped as missed bouts; a result that only arrives more than MAX_RESULT_LAG_MS after it isn't this clip's.
   * Returns the bout, or null when nothing fits (logged by the caller as unmatched; the cursor doesn't move).
   */
  async match(
    side: "east" | "west" | null,
    rematch = false,
    signalAt?: number,
    /** Live: wall-clock times of every result the graphic showed (for the "a later result owns it" rule). */
    allSignals: () => number[] = () => [],
  ): Promise<Bout | null> {
    if (rematch && this.last) return this.last;
    const deadline = Math.min(
      Date.now() + this.waitMs,
      signalAt === undefined ? Infinity : signalAt + MAX_RESULT_LAG_MS + POLL_MS,
    );
    const endedEarlier = (b: Bout) => {
      const seen = this.decidedSeenAt.get(boutIdOf(b));
      return signalAt !== undefined && seen !== undefined && seen < signalAt - DECIDED_BEFORE_SLACK_MS;
    };
    const decidedTooLate = (b: Bout) => {
      const seen = this.decidedSeenAt.get(boutIdOf(b));
      return signalAt !== undefined && seen !== undefined && seen > signalAt + MAX_RESULT_LAG_MS;
    };
    // An official result belongs to the LAST result the graphic showed before it (results reach the API 50+ s
    // after the bout). If another result was on screen after this clip's (and isn't just this bout repeated, see
    // REPEAT_GAP_MS) but before this bout's official result, this clip was a replay of an earlier bout.
    const ownedByLaterSignal = (b: Bout) => {
      const seen = this.decidedSeenAt.get(boutIdOf(b));
      if (signalAt === undefined || seen === undefined) return false;
      return allSignals().some((w) => w > signalAt + REPEAT_GAP_MS && w < seen - MIN_RESULT_LAG_MS);
    };
    for (;;) {
      // Missed bouts (decided before this clip's signal) can never match: move past them for good.
      while (this.cursor < this.bouts.length && (isFusen(this.bouts[this.cursor]) || endedEarlier(this.bouts[this.cursor]))) this.cursor++;
      const window: number[] = [];
      for (let i = this.cursor; i < this.bouts.length && window.length < 3; i++) if (!isFusen(this.bouts[i])) window.push(i);
      let waiting = false;
      for (const i of window) {
        const b = this.bouts[i];
        const w = winnerSide(b);
        if (!w) {
          waiting = true; // result not in yet: can't decide past it
          break;
        }
        // Its result came long after this signal: this clip isn't a real bout (highlights, replay). Leave the
        // cursor where it is for the next clip.
        if (decidedTooLate(b) || ownedByLaterSignal(b)) return null;
        if (side === null || w === side) {
          this.cursor = i + 1;
          this.last = b;
          return b;
        }
      }
      if (!waiting || Date.now() >= deadline) return null;
      await new Promise((r) => setTimeout(r, POLL_MS));
      await this.refresh().catch(() => {}); // a failed fetch just means trying again next poll
    }
  }
}
