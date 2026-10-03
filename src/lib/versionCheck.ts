// What the page does on returning to the foreground when a new deploy may be
// live (NEU-1504). An installed iOS app resumes the page it already has rather
// than reloading it, so without this a Home Screen user runs old code for days.

/** Hidden at least this long, a new version reloads outright: after that long
 * away the in-progress state is not worth protecting. Shorter, it only prompts,
 * because the user may be partway through typing a rating or a password. */
export const RELOAD_AFTER_HIDDEN_MS = 30 * 60 * 1000;

export type VersionAction = "reload" | "prompt" | "nothing";

export function decideVersionAction({
  current,
  deployed,
  hiddenMs,
  promptedVersion,
}: {
  current: string;
  deployed: string;
  hiddenMs: number;
  /** The deployed version the user was last offered a reload for, if any. */
  promptedVersion: string | null;
}): VersionAction {
  if (deployed === current) return "nothing";
  if (hiddenMs >= RELOAD_AFTER_HIDDEN_MS) return "reload";
  return promptedVersion === deployed ? "nothing" : "prompt";
}

/** The id from a parsed `version.json`, or null for anything else. Cloudflare
 * Pages answers a missing path with 200 and `index.html` (NEU-1482), so a body
 * that is not this shape is the normal failure, not an edge case. */
export function parseDeployedVersion(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const version = (body as { version?: unknown }).version;
  return typeof version === "string" && version !== "" ? version : null;
}
