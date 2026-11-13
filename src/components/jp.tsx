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
export function Romaji({ text, kind, jp }: { text?: string | null; kind: keyof typeof LOOKUP; jp?: string }) {
  if (!text) return null;
  const j = jp ?? LOOKUP[kind](text);
  // The API sends kimarite in lower case ("oshidashi"); show them capitalised ("Oshidashi").
  const shown = kind === "kimarite" ? text.charAt(0).toUpperCase() + text.slice(1) : text;
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
