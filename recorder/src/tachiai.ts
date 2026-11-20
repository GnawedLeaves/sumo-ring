// Finds the tachiai (start of the bout) in the audio before a result.
//
// What the stream sounds like (calibrated on Kyushu 2026 day 11 clips): during the final shikiri the hall goes
// almost silent (voice-band RMS ~0.001), then the gyoji's call and the crowd jump in at the tachiai (~0.05-0.1+
// within 250 ms) and stay loud through the bout. Earlier calls (e.g. a false start) are followed by more quiet, so
// the tachiai is the first sharp onset after the LAST long quiet stretch before the result.

export type Loud = { t: number; rms: number; voice: number };

export const TACHIAI = {
  /** How far back from the result to look. */
  maxLookbackSec: 240,
  /**
   * A "quiet stretch" must last at least this long. Real crouch hushes measured 0.75-1.5 s (Kyushu 2026 day 11 +
   * day 12 re-run); a mid-bout stalemate lull reached 0.5 s, which 0.5 let through. Was 0.5 (1.5 missed a short
   * hush after a late call).
   */
  minQuietSec: 0.75,
  /** Quiet = below this share of the loud level (the floor of the quiet threshold). */
  quietRatio: 0.04,
  /**
   * …or below this multiple of the window's background level (its 20th-percentile loudness), whichever is higher.
   * The crouch hush relative to the loud level varies a lot by hall/mix: ~3% on some clips, 11-15% on others
   * (Kyushu 2026 day 11), so a fixed 4% missed 6 of 8 tachiai.
   */
  floorFactor: 1.4,
  floorPercentile: 0.2,
  /** Onset = first window at least this share of the loud level, right after the quiet. */
  onsetRatio: 0.3,
} as const;

/**
 * Known limit, mizu-iri (water break): the gyoji stops a very long bout, re-grips the wrestlers in silence, then
 * restarts it; that hush + roar is the last one before the result, so the clip starts at the restart (Kyushu 2026
 * day 13, Juryo #3). A "was a bout already roaring before this hush?" check fixed that bout but was tried and
 * removed the same day: the crowd's cheers for popular wrestlers during shikiri look the same (Juryo #9, #10:
 * clips started 66-76 s early, in the salt throwing). Water breaks are rare; re-cut those by hand from --keep.
 */

/**
 * Returns the tachiai time (seconds, same clock as `loud`) before `beforeT`, or null when there's no clear quiet →
 * loud onset (caller falls back to a fixed window).
 */
export function findTachiai(loud: Loud[], beforeT: number, from = beforeT - TACHIAI.maxLookbackSec): number | null {
  const win = loud.filter((l) => l.t >= from && l.t <= beforeT);
  if (win.length < 10) return null;
  const step = win[1].t - win[0].t;
  // "Loud" reference: the 90th percentile of the window, so a single spike doesn't set the scale.
  const sorted = win.map((l) => l.voice).sort((a, b) => a - b);
  const loudRef = sorted[Math.floor(sorted.length * 0.9)];
  if (!loudRef) return null;
  const floor = sorted[Math.floor(sorted.length * TACHIAI.floorPercentile)];
  const quietMax = Math.max(loudRef * TACHIAI.quietRatio, floor * TACHIAI.floorFactor);
  const onsetMin = loudRef * TACHIAI.onsetRatio;
  const minQuietN = Math.ceil(TACHIAI.minQuietSec / step);

  // Walk back from the result; find the last quiet run of sufficient length.
  let i = win.length - 1;
  while (i >= 0) {
    if (win[i].voice <= quietMax) {
      let j = i;
      while (j - 1 >= 0 && win[j - 1].voice <= quietMax) j--;
      if (i - j + 1 >= minQuietN) {
        // First loud window after the quiet run.
        for (let k = i + 1; k < win.length && k <= i + Math.ceil(2 / step); k++) {
          if (win[k].voice >= onsetMin) return win[k].t;
        }
      }
      i = j - 1;
    } else i--;
  }
  return null;
}
