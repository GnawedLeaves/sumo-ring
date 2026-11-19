// Auto-clipper worker config: whether to run, when to start, and which Twitch streams to try (in order).
// `Authorization: Bearer $RECORDER_SECRET`.
import { getStreams } from "@/lib/content";
import { recorderAuthError } from "@/lib/recorder-auth";

/**
 * Defaults until the admin settings (Hygraph model RecorderSettings, Streams page) exist. Start time is SGT;
 * Juryo usually starts around 2pm SGT.
 */
const DEFAULT_SETTINGS = { enabled: true, startTimeSgt: "14:00", stopTimeSgt: "17:15" };

export async function GET(request: Request) {
  const denied = recorderAuthError(request);
  if (denied) return denied;
  const streams = (await getStreams())
    .filter((s) => s.platform === "twitch")
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ name: s.name, url: s.url }));
  return Response.json({ ...DEFAULT_SETTINGS, streams });
}
