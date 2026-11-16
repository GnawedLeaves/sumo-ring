import Image from "next/image";
import { toneClass } from "@/lib/rikishi-color";

const SIZES = { sm: { px: 32, cls: "h-8 w-8 text-caption" }, md: { px: 40, cls: "h-10 w-10 text-body-sm" }, lg: { px: 96, cls: "h-24 w-24 text-heading" } };

/** A user's picture, or their palette colour with their initial when they haven't uploaded one. */
export function UserAvatar({
  name,
  color,
  photoURL,
  size = "md",
}: {
  name: string;
  color: number;
  photoURL?: string | null;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span aria-hidden className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${s.cls} ${toneClass(color)}`}>
      {photoURL ? <Image src={photoURL} alt="" fill sizes={`${s.px}px`} className="object-cover" /> : initial}
    </span>
  );
}
