import { X } from "lucide-react";

import { useDismissRecommendation } from "@/api/me";

/** The chip that removes one suggestion from "My Recommendations" for good
 * (NEU-1179).
 *
 * It owns its mutation, exactly as `MyShowsButton` owns its two — so the seam
 * `ShowCard` / `ShowGrid` thread is a flat `dismissible` boolean rather than a
 * per-row callback, which is the shape NEU-1176 established one ticket ago for
 * the same job on the same card. `onDismissed` is not that mutation coming back
 * up: it reports *that a dismissal landed*, so the surface can move focus
 * (`RecommendedForYou`), and it is passed as one function reference to every
 * card rather than as a closure per row.
 *
 * **The copy names the recommendation, never a preference.** "Don't recommend
 * *{name}* again" says what the action does and that it is permanent. "Not
 * interested" says the viewer dislikes the show — which is the one claim this
 * whole feature refuses to record: a dismissal is deliberately kept out of the
 * taste payload's `not_liked` tier, because dismissing three prestige dramas
 * you had already seen elsewhere must not teach the model to stop recommending
 * prestige drama (NEU-1177, NEU-1178 §4).
 *
 * **The accessible name carries the show's name**, where `MyShowsButton` uses a
 * flat "Add to My Shows" and twelve identical ones sit on this very grid. It is
 * worth the divergence here because this is the destructive, irreversible
 * control: hearing "Don't recommend Severance again" is the difference between
 * confirming and guessing.
 *
 * **No confirm dialog.** A modal per card on a twelve-card grid is heavy for a
 * one-tap action, and the loss it would guard is bounded — the *suggestion*
 * goes, the show does not: trending, most anticipated, similar shows, search
 * and browse are unaffected by a dismissal (NEU-1112 contract §5.1), so a
 * dismissed show stays findable. A toast-with-undo is unbuildable, since the
 * backend ships no un-dismiss. The label carries the permanence instead.
 *
 * **Always visible, never hover-revealed**: Discover is a mobile-first surface
 * with no hover at all, so a hover-reveal is an affordance most of its readers
 * do not have. The 24px chip is well below the 44px tap-target guideline, so
 * the button's padding — not its box — is the hit area, and it is load-bearing
 * rather than decoration.
 */
export function DismissRecommendationButton({
  showId,
  showName,
  onDismissed,
}: {
  showId: number;
  showName: string;
  onDismissed?: (showId: number) => void;
}) {
  const dismiss = useDismissRecommendation();

  return (
    <button
      type="button"
      // The attribute is `RecommendedForYou`'s handle for the post-dismissal
      // focus move (NEU-1179 §3.4). It is deliberately explicit: the surface
      // reaches into the rendered card by attribute rather than through three
      // levels of ref forwarding across components shared by five surfaces
      // that need none of it.
      data-dismiss-recommendation=""
      onClick={() => dismiss.mutate(showId, { onSuccess: () => onDismissed?.(showId) })}
      disabled={dismiss.isPending}
      aria-label={`Don't recommend ${showName} again`}
      title="Don't recommend this again"
      className="absolute top-0 right-0 z-10 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur">
        <X className="h-3.5 w-3.5" aria-hidden />
      </span>
    </button>
  );
}
