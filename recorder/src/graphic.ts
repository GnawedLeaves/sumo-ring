// Reads the ABEMA bout graphic (top-left of the stream) and measures the colours that change when a bout ends.
//
// Layout on a 1280x720 frame (calibrated from the stream, Nov 2026):
//   [ name box east ]  ABEMA logo  [ name box west ]     y 6-66
//   [ score  east   ]              [ score  west   ]     y 70-100  ("○ wins ● losses")
// When a bout is decided the winner's name box gets a thick red-orange border + pink fill, and the changed
// score digits turn red. A yellow highlight means an unsure result / rematch (mono-ii, torinaoshi).

/** The strip of the frame we decode: everything the detector looks at sits inside it. */
export const STRIP = { x: 0, y: 0, w: 440, h: 104 } as const;

type Box = { x0: number; y0: number; x1: number; y1: number };

/** Boxes inside the strip, for a 1280x720 source (the strip is scaled to this size before reading). */
export const BOXES = {
  east: { name: { x0: 8, y0: 6, x1: 183, y1: 66 }, score: { x0: 8, y0: 70, x1: 183, y1: 100 } },
  west: { name: { x0: 260, y0: 6, x1: 434, y1: 66 }, score: { x0: 260, y0: 70, x1: 434, y1: 100 } },
} as const satisfies Record<"east" | "west", { name: Box; score: Box }>;

export type SideFeatures = {
  /** Share of strong-red pixels inside the score box (red digits). */
  scoreRed: number;
  /** Share of red-orange pixels in the name box's border band (thick winner border). */
  borderRed: number;
  /** Mean pinkness (R - B) of the name box interior; white ≈ 0, winner's pink fill > 0. */
  fillPink: number;
  /** Share of yellow pixels in the name box (border + interior). */
  yellow: number;
};

export type Features = { east: SideFeatures; west: SideFeatures };

const isStrongRed = (r: number, g: number, b: number) => r > 170 && g < 100 && b < 100;
const isRedOrange = (r: number, g: number, b: number) => r > 190 && g < 140 && b < 120 && r - g > 70;
const isYellow = (r: number, g: number, b: number) => r > 190 && g > 160 && b < 110 && r - b > 100;

function measure(px: Buffer, width: number, box: Box, pred: (r: number, g: number, b: number) => boolean, band?: number) {
  let hit = 0;
  let n = 0;
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      if (band !== undefined) {
        const inner = x >= box.x0 + band && x < box.x1 - band && y >= box.y0 + band && y < box.y1 - band;
        if (inner) continue;
      }
      const i = (y * width + x) * 3;
      n++;
      if (pred(px[i], px[i + 1], px[i + 2])) hit++;
    }
  }
  return n ? hit / n : 0;
}

function meanPink(px: Buffer, width: number, box: Box) {
  let sum = 0;
  let n = 0;
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * width + x) * 3;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      // Only the light background, not the black text or the blue side bar.
      if (r + g + b < 540) continue;
      sum += r - b;
      n++;
    }
  }
  return n ? sum / n : 0;
}

const inset = (b: Box, d: number, left = d): Box => ({ x0: b.x0 + left, y0: b.y0 + d, x1: b.x1 - d, y1: b.y1 - d });

/** `px` is one rgb24 frame of the strip, STRIP.w x STRIP.h. */
export function readGraphic(px: Buffer): Features {
  const side = (s: "east" | "west"): SideFeatures => {
    const { name, score } = BOXES[s];
    return {
      scoreRed: measure(px, STRIP.w, inset(score, 5), isStrongRed),
      borderRed: measure(px, STRIP.w, name, isRedOrange, 5),
      // Skip the blue bar on the left of each name box.
      fillPink: meanPink(px, STRIP.w, inset(name, 8, 20)),
      yellow: measure(px, STRIP.w, name, isYellow),
    };
  };
  return { east: side("east"), west: side("west") };
}
