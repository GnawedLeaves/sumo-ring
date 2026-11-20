// Auto-clipper save: POST { boutId, assetId, eastShikona, westShikona, note? } -> attaches the processed upload
// to the bout as a clip. Saved even if the bout already has a clip; remarks mark it as an auto clip.
// `Authorization: Bearer $RECORDER_SECRET`.
import { revalidateTag } from "next/cache";
import { boutTitle } from "@/lib/basho";
import { createUploadedClip } from "@/lib/clips";
import { parseBoutId } from "@/lib/format";
import { TAGS } from "@/lib/content";
import { recorderAuthError, recorderFailure } from "@/lib/recorder-auth";

type Body = {
  boutId?: string;
  assetId?: string;
  eastShikona?: string;
  westShikona?: string;
  note?: string;
};

export async function POST(request: Request) {
  const denied = recorderAuthError(request);
  if (denied) return denied;
  const b = (await request.json().catch(() => ({}))) as Body;
  if (!b.boutId || !b.assetId || !b.eastShikona || !b.westShikona) {
    return Response.json(
      { error: "Need boutId, assetId, eastShikona and westShikona" },
      { status: 400 },
    );
  }
  try {
    const bout = parseBoutId(b.boutId);
    const clip = await createUploadedClip({
      boutId: b.boutId,
      // Same title the bout page's copy button / manual clips use: "Kyushu Basho 2026 Day 12: A vs B".
      title: bout
        ? boutTitle(bout.bashoId, bout.day, b.eastShikona, b.westShikona)
        : undefined,
      assetId: b.assetId,
      eastShikona: b.eastShikona,
      westShikona: b.westShikona,
      // e.g. "Auto clip" or "Auto clip · Rematch"
      remarks: ["Auto clipped", b.note].filter(Boolean).join(" · "),
    });
    // updateTag is Server Actions only; expire 0 so the next visit shows the clip (no stale page).
    revalidateTag(TAGS.clips, { expire: 0 });
    return Response.json({
      ok: true,
      clipId: clip.id,
      videoUrl: clip.videoUrl,
    });
  } catch (e) {
    return recorderFailure(
      e,
      e instanceof Error && /Unknown bout|processing|not found/.test(e.message)
        ? 400
        : 502,
    );
  }
}
