import { ImageResponse } from "next/og";

/**
 * App icon: a dohyō ring (cream) with a tangerine centre on the indigo brand colour.
 * `safe` shrinks the mark for maskable icons, which Android may crop to a circle (keep within ~80%).
 */
export function appIcon(px: number, { safe = false } = {}) {
  const ring = Math.round(px * (safe ? 0.5 : 0.66));
  const stroke = Math.max(4, Math.round(px * 0.055));
  const dot = Math.round(px * (safe ? 0.13 : 0.17));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#160572" }}>
        <div
          style={{
            width: ring,
            height: ring,
            borderRadius: "50%",
            border: `${stroke}px solid #f2ebe6`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: dot, height: dot, borderRadius: "50%", background: "#ff7701" }} />
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
