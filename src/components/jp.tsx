import { KimariteTerm } from "@/components/kimarite-term";
import { divisionJp, heyaJp, kimariteJp, rankJp, sanshoJp, shusshinJp, termJp } from "@/lib/glossary";

const LOOKUP = {
  kimarite: kimariteJp,
  rank: rankJp,
  division: divisionJp,
  heya: heyaJp,
  sansho: sanshoJp,
  shusshin: shusshinJp,
  term: termJp,
} as const;

/**
 * Romaji followed by its Japanese in smaller type, e.g. "yorikiri 寄り切り".
 * Renders the romaji alone when the term isn't in the glossary.
 */
export function Romaji({
  text,
  kind,
  jp,
  link = true,
}: {
  text?: string | null;
  kind: keyof typeof LOOKUP;
  jp?: string;
  /** Kimarite only: link to the technique page. Set false when already inside a link. */
  link?: boolean;
}) {
  if (!text) return null;
  // Kimarite get a hover explanation and link to /kimarite/<name>.
  if (kind === "kimarite") return <KimariteTerm name={text} jp={jp} link={link} />;
  const j = jp ?? LOOKUP[kind](text);
  const shown = text;
  return (
    <>
      {shown}
      {j && (
        <span lang="ja" className="ml-1 font-jp text-[0.8em] font-normal opacity-75">
          {j}
        </span>
      )}
    </>
  );
}
