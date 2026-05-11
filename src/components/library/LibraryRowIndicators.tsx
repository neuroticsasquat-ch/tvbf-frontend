import { Check } from "lucide-react";
import { callerHasShow, callerProgress, type CallerLibrary } from "./callerLibrary";
import type { ViewerContext } from "./LibraryActiveList";

/** Green ✓ overlay rendered on a list-view poster when the caller has the
 * show in their own My Shows. Suppressed for self mode (their own library
 * already implies tracking) or when no caller relationship exists. */
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
  return (
    <span
      className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow"
      title="In My Shows"
      aria-label="In My Shows"
    >
      <Check className="h-3.5 w-3.5" aria-hidden strokeWidth={3} />
    </span>
  );
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
