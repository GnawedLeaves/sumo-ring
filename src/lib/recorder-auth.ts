import "server-only";

/**
 * Auth for the auto-clipper worker's endpoints (/api/recorder/*): `Authorization: Bearer $RECORDER_SECRET`.
 * Returns an error Response to send back, or null when the request may proceed.
 */
export function recorderAuthError(request: Request): Response | null {
  const secret = process.env.RECORDER_SECRET;
  if (!secret) return Response.json({ error: "RECORDER_SECRET is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** A thrown error as a JSON response (status 400 for bad input, 502 when Hygraph itself failed). */
export function recorderFailure(e: unknown, status = 502) {
  return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status });
}
