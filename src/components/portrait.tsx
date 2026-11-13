import Image from "next/image";
import { shikonaOnly } from "@/lib/format";
import { toneClass, toneOf, type ToneIndex } from "@/lib/rikishi-color";

const SIZES = {
  sm: { box: "h-12 w-12", disc: "h-8 w-8 text-body-sm", px: 48 },
  md: { box: "h-24 w-24", disc: "h-16 w-16 text-subheading", px: 96 },
  // lg/xl shrink on phones so two portraits + "vs" fit side by side in ~340px
  lg: { box: "h-24 w-24 sm:h-40 sm:w-40", disc: "h-16 w-16 text-subheading sm:h-28 sm:w-28 sm:text-heading", px: 160 },
  /** Fills its container's width as a square — for grid cards. */
  fill: { box: "aspect-square w-full", disc: "aspect-square w-3/5 text-heading-lg sm:text-display", px: 320 },
  xl: { box:"h-40 w-40 sm:h-56 sm:w-56 md:h-72 md:w-72", disc: "h-28 w-28 text-heading sm:h-40 sm:w-40 sm:text-heading-lg md:h-52 md:w-52", px: 288 },
} as const;

/**
 * Rikishi portrait. The Sumo API has no images, so unless a portrait was uploaded to Hygraph we
 * render a flat colour block with a circular cutout holding the first kanji of the shikona. Photos keep the
 * rikishi's colour as a strip along the bottom, so it still matches their side of the head-to-head bar.
 */
export function Portrait({
  id,
  en,
  jp,
  src,
  size = "md",
  tone,
}: {
  id: number;
  en: string;
  jp?: string;
  src?: string;
  size?: keyof typeof SIZES;
  /** Override the colour (e.g. from pairTones, so two opponents never share one). Defaults to the rikishi's own. */
  tone?: ToneIndex;
}) {
  const s = SIZES[size];
  const color = toneClass(tone ?? toneOf(id));
  if (src) {
    return (
      <div className={`${s.box} relative shrink-0 overflow-hidden bg-white`}>
        <Image src={src} alt={en} fill sizes={size === "fill" ? "(min-width: 1024px) 280px, 50vw" : `${s.px}px`} className="object-cover object-top" />
        <span aria-hidden className={`absolute inset-x-0 bottom-0 ${size === "sm" ? "h-1" : "h-1.5 sm:h-2"} ${color}`} />
      </div>
    );
  }
  const glyph = shikonaOnly(jp).charAt(0) || en.charAt(0);
  return (
    <div className={`${s.box} ${color} flex shrink-0 items-center justify-center`} aria-label={en} role="img">
      <span className={`${s.disc} flex items-center justify-center rounded-full bg-cream-paper font-display font-bold text-indigo-frame`}>
        {glyph}
      </span>
    </div>
  );
}
