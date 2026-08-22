import type { RatingOwner } from "@/lib/rating";

/** Whose library a list is rendering.
 *
 * A discriminated union carrying the friend's name, rather than the
 * `"self" | "friend"` string union it was until NEU-1181. Friend mode has to
 * attribute the friend's facts by name (NEU-1182 §6.1), and a bare `"friend"`
 * let a nameless friend mode exist — which is the state that produced the
 * mislabelled rating: no component downstream could tell whose `my_rating` it
 * was holding, so both card surfaces guessed "yours". Carrying the name here
 * makes that unconstructable rather than merely corrected (§3.3).
 *
 * It lives in its own module because `LibraryActiveList` exported it until this
 * ticket, and both `LibraryRowIndicators` and `LibraryWatchedList` import it —
 * a leaf type depending on the largest component in the folder.
 */
export type ViewerContext = { kind: "self" } | { kind: "friend"; name: string };

/** Self mode. A shared constant so the two list components' defaults are one
 * value rather than two object literals that have to stay equal. */
export const SELF: ViewerContext = { kind: "self" };

/** Whose facts a row or card of this library holds, resolved from the viewer
 * context.
 *
 * The whole of NEU-1181 in one expression: whose `my_rating`,
 * `watched_episode_count` and `last_watched_at` a library entry carries is
 * decided by whoever knows whose library was fetched, and handed downstream as
 * an answer rather than as the sources to infer it from (NEU-1176's seam). It
 * lives beside the context rather than in either list component, because both
 * lists ask the same question of the same type. */
export function ratingOwnerFor(viewerContext: ViewerContext): RatingOwner {
  return viewerContext.kind === "friend"
    ? { kind: "other", ownerName: viewerContext.name }
    : { kind: "own" };
}
