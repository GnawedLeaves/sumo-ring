import Image from "next/image";
import { shikonaOnly } from "@/lib/format";

const BLOCKS = ["bg-cobalt-stage", "bg-tangerine-pop", "bg-plum-velvet", "bg-rose-petal", "bg-vermillion"];

const SIZES = {
  sm: { box: "h-12 w-12", disc: "h-8 w-8 text-body-sm", px: 48 },
  md: { box: "h-24 w-24", disc: "h-16 w-16 text-subheading", px: 96 },
  lg: { box: "h-40 w-40", disc: "h-28 w-28 text-heading", px: 160 },
  xl: { box: "h-56 w-56 md:h-72 md:w-72", disc: "h-40 w-40 md:h-52 md:w-52 text-heading-lg", px: 288 },
} as const;

/**
 * Rikishi portrait. The Sumo API has no images, so unless a portrait was uploaded to Hygraph we
 * render a flat colour block with a circular cutout holding the first kanji of the shikona.
 */
export function Portrait({
  id,
  en,
  jp,
  src,
  size = "md",
}: {
  id: number;
  en: string;
  jp?: string;
  src?: string;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  if (src) {
    return (
      <div className={`${s.box} relative shrink-0 overflow-hidden bg-white`}>
        <Image src={src} alt={en} fill sizes={`${s.px}px`} className="object-cover object-top" />
      </div>
    );
  }
  const glyph = shikonaOnly(jp).charAt(0) || en.charAt(0);
  return (
    <div className={`${s.box} ${BLOCKS[id % BLOCKS.length]} flex shrink-0 items-center justify-center`} aria-label={en} role="img">
      <span className={`${s.disc} flex items-center justify-center rounded-full bg-cream-paper font-display font-bold text-indigo-frame`}>
        {glyph}
      </span>
    </div>
  );
}
