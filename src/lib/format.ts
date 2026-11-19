export function record(w: number, l: number, a = 0) {
  return a ? `${w}-${l}-${a}` : `${w}-${l}`;
}

export function boutId(m: { bashoId: string; day: number; matchNo: number; eastId: number; westId: number }) {
  return `${m.bashoId}-${m.day}-${m.matchNo}-${m.eastId}-${m.westId}`;
}

export function parseBoutId(id: string) {
  const [bashoId, day, matchNo, eastId, westId] = id.split("-");
  const out = { bashoId, day: Number(day), matchNo: Number(matchNo), eastId: Number(eastId), westId: Number(westId) };
  if (!/^\d{6}$/.test(bashoId ?? "") || [out.day, out.matchNo, out.eastId, out.westId].some((n) => !Number.isFinite(n))) {
    return null;
  }
  return out;
}

export function formatDate(iso?: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
}

export function ageFrom(iso?: string, now = new Date()) {
  if (!iso) return null;
  const b = new Date(iso);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** "202303" -> "Mar 2023" */
export function yyyymm(id?: string) {
  if (!id || id.length < 6) return "—";
  return new Date(Date.UTC(Number(id.slice(0, 4)), Number(id.slice(4, 6)) - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Japanese shikona from the API include the given name after a full-width space. */
export function shikonaOnly(jp?: string) {
  return (jp ?? "").split(/[\s　(（]/)[0];
}

export function topEntries(rec: Record<string, number> | undefined, n = 5) {
  return Object.entries(rec ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/** "53%", or with `decimals` "53.27%". */
export function pct(n: number, d: number, decimals = 0) {
  return d ? `${((n / d) * 100).toFixed(decimals)}%` : "—";
}
