"use client";

import { useRouter } from "next/navigation";

/** Jump-to dropdown of every past basho, grouped by year. */
export function BashoPicker({ groups, current }: { groups: { year: string; basho: { id: string; label: string }[] }[]; current?: string }) {
  const router = useRouter();
  return (
    <label className="flex flex-col gap-1 text-caption font-bold uppercase text-ink-soft sm:flex-row sm:items-center sm:gap-3">
      Jump to basho
      <select
        value={current ?? ""}
        onChange={(e) => e.target.value && router.push(`/basho/${e.target.value}`)}
        className="border border-line bg-surface px-3 py-2 text-body-sm font-normal normal-case text-ink"
      >
        <option value="" disabled>
          Choose a basho…
        </option>
        {groups.map((g) => (
          <optgroup key={g.year} label={g.year}>
            {g.basho.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
