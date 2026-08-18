import { callerProgress, type CallerLibrary } from "./callerLibrary";
import type { ViewerContext } from "./viewerContext";

/** "You: x/y" muted-text affordance for a friend row, shown whenever the caller
 * has watched at least one episode — irrespective of whether they also track
 * the show. Pairs with the poster mark `callerPosterMark` gates when both
 * apply, giving a direct progress comparison against the friend's row. Renders
 * as an inline span so callers can drop it into the action-button row
 * immediately beside the button. */
export function CallerProgressNote({
  showId,
  viewerContext,
  callerLibrary,
}: {
  showId: number;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
}) {
  if (viewerContext.kind !== "friend") return null;
  const progress = callerProgress(callerLibrary, showId);
  if (!progress) return null;
  return (
    <span className="text-xs text-muted-foreground/80">
      You: {progress.watched}/{progress.aired}
    </span>
  );
}
