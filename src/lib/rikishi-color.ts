// Each rikishi gets a stable colour from the design-system palette. It fills their placeholder portrait, edges
// their photo, and marks their side of the head-to-head bar, so the same colour always means the same wrestler.

/** Tailwind background classes, in palette order. (Full class names so Tailwind picks them up.) */
const COLORS = ["bg-cobalt-stage", "bg-tangerine-pop", "bg-plum-velvet", "bg-rose-petal", "bg-vermillion"] as const;

export type ToneIndex = number;

/** A rikishi's own colour index, stable across the app. */
export function toneOf(id: number): ToneIndex {
  return ((id % COLORS.length) + COLORS.length) % COLORS.length;
}

export function toneClass(tone: ToneIndex): string {
  return COLORS[tone % COLORS.length];
}

/**
 * Colours for two opponents. Usually each keeps their own colour; if they'd clash, the west side takes the next
 * palette colour so the pair (portraits + head-to-head bar) can always be told apart.
 */
export function pairTones(eastId: number, westId: number): [ToneIndex, ToneIndex] {
  const e = toneOf(eastId);
  const w = toneOf(westId);
  return [e, w === e ? (w + 1) % COLORS.length : w];
}
