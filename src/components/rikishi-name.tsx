import { shikonaOnly } from "@/lib/format";

/**
 * English shikona as the main text with the Japanese shikona alongside in smaller type.
 * The API's Japanese names include the given name ("大の里　泰輝"); only the shikona is shown.
 */
export function RikishiName({ en, jp, stacked = false }: { en: string; jp?: string; stacked?: boolean }) {
  const j = shikonaOnly(jp);
  if (!j) return <>{en}</>;
  return (
    <>
      {en}
      {stacked ? (
        <span className="block font-jp text-[0.7em] font-normal leading-tight opacity-80">{j}</span>
      ) : (
        <span className="ml-1.5 font-jp text-[0.75em] font-normal opacity-80" lang="ja">
          {j}
        </span>
      )}
    </>
  );
}
