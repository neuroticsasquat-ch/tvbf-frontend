import type { ShowPosterSize } from "@/components/ShowPoster";
import { cn } from "@/lib/cn";

/** "You: x/y" — the **viewer's own** progress, drawn beside someone else's row
 * or card so the two are directly comparable ("they're 10/10, I'm 3/10 —
 * spoiler risk"). Rendered whenever the viewer has watched at least one
 * episode, irrespective of whether they also track the show; it pairs with the
 * library mark that `callerPosterMark` gates when both apply.
 *
 * **It takes the resolved progress, and gates on nothing else.** It used to
 * take `showId` + `viewerContext` + `callerLibrary` and re-derive the answer,
 * which meant only a surface holding all three could draw it — and a grid card
 * holds none of them, which is precisely why the friend grid carried no
 * comparison at all (NEU-1188 AC 3). The derivation now lives once in
 * `activeCallerRelationship` / `watchedCallerRelationship`, on the same
 * take-the-answer seam as `MyShowsButton` and `ratingOwner`.
 *
 * An inline span, so a caller can drop it straight into an action row.
 */
export function CallerProgressNote({
  progress,
  size = "row",
}: {
  progress: { watched: number; aired: number } | null;
  /** Density — **a variant, not a `className`**, on `ShowPoster`'s rule: the
   * two real densities are a list row's and a grid card's, and anything else is
   * a new surface making a decision that belongs here. They are the same two
   * `OwnerFacts` draws its group at, and the 10px is measured (§6.3): at 12px
   * inside the ~97px of a `grid-cols-3` card the line wraps unpredictably at
   * exactly the width that matters. */
  size?: ShowPosterSize;
}) {
  if (!progress) return null;
  return (
    <span
      className={cn(
        "text-muted-foreground/80",
        size === "row" ? "text-xs" : "text-[10px] leading-tight",
      )}
    >
      You: {progress.watched}/{progress.aired}
    </span>
  );
}
