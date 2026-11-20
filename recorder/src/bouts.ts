// Turns per-frame graphic readings into bout events, and events + audio into clip windows.
import type { Features, SideFeatures } from "./graphic.ts";
import { findTachiai, type Loud } from "./tachiai.ts";

export const ENDS = {
  /** Winner highlight: share of red-orange pixels in the name box border (normal ≈ 0-4%, winner ≈ 60%). */
  borderRedMin: 0.3,
  /** Winner highlight: pink fill (normal ≈ 3-7, winner ≈ 25-30). */
  fillPinkMin: 15,
  /** Unsure result / rematch highlight. Not seen on footage yet — tune once a mono-ii is recorded. */
  yellowMin: 0.15,
  /** A highlight must hold this long before it counts (filters single-frame glitches/transitions). */
  holdSec: 0.5,
  /** Both boxes back to normal for this long = next bout's graphic, so we re-arm. */
  rearmSec: 2,
} as const;

export const WINDOW = {
  /** Seconds kept before the tachiai. */
  beforeSec: 5,
  /** Seconds kept after the graphic highlights the result. Note the graphic updates ~5 s after the bout
   * actually ends, so this already includes ~10 s of reactions. */
  afterSec: 5,
  /** When no tachiai is found: clip this long before the result (+ afterSec ≈ a 30 s clip, the owner's preferred
   * length). The graphic lags the real end by ~5 s, so this still covers ~20 s of bout + the run-up. Was 45 s. */
  fallbackSec: 25,
  /** A result needs a tachiai at most this long before it (longest bouts are ~4 min, very rare). */
  maxBoutSec: 180,
} as const;

export type Side = "east" | "west";
/** `followsYellow`: a red that came after a yellow on the same graphic (no reset in between). */
export type EndEvent = { t: number; kind: "red" | "yellow"; side: Side; followsYellow: boolean };

const sideState = (s: SideFeatures): "red" | "yellow" | "normal" =>
  s.borderRed >= ENDS.borderRedMin && s.fillPink >= ENDS.fillPinkMin ? "red" : s.yellow >= ENDS.yellowMin ? "yellow" : "normal";

/** Feed frames in time order; returns an event when a highlight first holds. Stateful (one per stream). */
export class EndDetector {
  // Starts disarmed: joining mid-afternoon, the previous bout's result is usually still highlighted, and that
  // isn't a new result. Arms once both boxes have been normal for rearmSec (the next bout's graphic).
  private armed = false;
  private lastKind: "red" | "yellow" | null = null;
  private candidate: { t: number; kind: "red" | "yellow"; side: Side } | null = null;
  private normalSince: number | null = null;

  push(t: number, g: Features): EndEvent | null {
    // Graphic off screen (replay transition, close-up without it): tells us nothing. It neither counts as a
    // result nor as "back to normal", and it breaks a normal streak so re-arming needs the real graphic.
    if (!g.present) {
      this.normalSince = null;
      return null;
    }
    const e = sideState(g.east);
    const w = sideState(g.west);
    const hit = e !== "normal" ? { kind: e, side: "east" as const } : w !== "normal" ? { kind: w, side: "west" as const } : null;

    if (!hit) {
      this.candidate = null;
      this.normalSince ??= t;
      if (t - this.normalSince >= ENDS.rearmSec) {
        this.armed = true;
        this.lastKind = null;
      }
      return null;
    }
    this.normalSince = null;
    // After a yellow, a red is still news (confirmed result or rematch result); anything else waits for re-arm.
    const wanted = this.armed || (this.lastKind === "yellow" && hit.kind === "red");
    if (!wanted) return null;
    if (!this.candidate || this.candidate.kind !== hit.kind || this.candidate.side !== hit.side) {
      this.candidate = { t, ...hit };
      return null;
    }
    if (t - this.candidate.t + 1e-9 < ENDS.holdSec) return null;
    const ev: EndEvent = { ...this.candidate, followsYellow: !this.armed && this.lastKind === "yellow" };
    this.candidate = null;
    this.armed = false;
    this.lastKind = ev.kind;
    return ev;
  }
}

export type ClipPlan = {
  /** Result time (graphic highlight). */
  endT: number;
  winner: Side | null;
  tachiaiT: number | null;
  startT: number;
  stopT: number;
  /** "Rematch" for the second clip after a yellow; "fallback" when no tachiai was found. */
  note?: "Rematch" | "fallback";
  kind: "red" | "yellow";
};

/**
 * Plans clips from end events:
 * - red (no yellow before)        -> one clip [tachiai - 5, red + 5]
 * - yellow                        -> one clip [tachiai - 5, yellow + 5]
 * - yellow then red, new tachiai  -> a second clip [new tachiai - 5, red + 5], note "Rematch"
 * - yellow then red, no new one   -> red only confirms the first clip (no new clip)
 */
export function planClips(events: EndEvent[], loud: Loud[]): ClipPlan[] {
  const plans: ClipPlan[] = [];
  let prev: EndEvent | null = null;
  for (const ev of events) {
    const plan = planOne(ev, prev, loud);
    if (plan) plans.push(plan);
    else {
      // Confirmation of the yellow bout's result: record the winner on that clip, no new clip.
      const last = plans.at(-1);
      if (last) last.winner = ev.side;
    }
    prev = ev;
  }
  return plans;
}

/**
 * Plans the clip for one end event, given the event before it (the tachiai can't be before that one).
 * Returns null when the event only confirms the previous (yellow) clip — see planClips.
 * `loud` must cover [ev.t - maxBoutSec, ev.t]; the live watcher keeps a rolling window of it.
 */
export function planOne(ev: EndEvent, prev: EndEvent | null, loud: Loud[]): ClipPlan | null {
  const from = Math.max(prev ? prev.t : -Infinity, ev.t - WINDOW.maxBoutSec);
  const tachiai = findTachiai(loud, ev.t, from);
  if (ev.followsYellow && tachiai === null) return null;
  return {
    endT: ev.t,
    kind: ev.kind,
    winner: ev.kind === "red" ? ev.side : null,
    tachiaiT: tachiai,
    startT: Math.max(0, tachiai === null ? ev.t - WINDOW.fallbackSec : tachiai - WINDOW.beforeSec),
    stopT: ev.t + WINDOW.afterSec,
    note: ev.followsYellow ? "Rematch" : tachiai === null ? "fallback" : undefined,
  };
}
