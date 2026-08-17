import { InMyShowsBadge } from "@/components/InMyShowsBadge";
import { callerHasShow, callerProgress, type CallerLibrary } from "./callerLibrary";
import type { ViewerContext } from "./LibraryActiveList";

/** The "in My Shows" mark on a list-view poster, when the caller has the show
 * in their own My Shows. Suppressed for self mode (their own library already
 * implies tracking) or when no caller relationship exists.
 *
 * The mark itself is `InMyShowsBadge` — it used to be a green ✓ drawn here, one
 * of the three separate definitions that ticket unified. */
export function CallerPosterBadge({
  showId,
  viewerContext,
  callerLibrary,
}: {
  showId: number;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
}) {
  if (viewerContext !== "friend") return null;
  if (!callerHasShow(callerLibrary, showId)) return null;
  return <InMyShowsBadge className="top-1 right-1" />;
}

/** "You: x/y" muted-text affordance for a friend row, shown whenever the caller
 * has watched at least one episode — irrespective of whether they also track
 * the show. Pairs with `<CallerPosterBadge>` when both apply, giving a direct
 * progress comparison against the friend's row. Renders as an inline span so
 * callers can drop it into the action-button row immediately beside the
 * button. */
export function CallerProgressNote({
  showId,
  viewerContext,
  callerLibrary,
}: {
  showId: number;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
}) {
  if (viewerContext !== "friend") return null;
  const progress = callerProgress(callerLibrary, showId);
  if (!progress) return null;
  return (
    <span className="text-xs text-muted-foreground/80">
      You: {progress.watched}/{progress.aired}
    </span>
  );
}
