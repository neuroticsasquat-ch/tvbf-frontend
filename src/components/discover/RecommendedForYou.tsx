import { useRef } from "react";

import { useRecommendations } from "@/api/me";
import { ShowGrid } from "@/components/ShowGrid";

/** The "My Recommendations" tab of the Discover page (NEU-1114).
 *
 * Renders nothing at all when there is nothing to show — no empty state, no
 * "add more shows" nudge, no spinner, no error. That covers a user whose set
 * has never been generated, one below the generation floor, one whose Sunday
 * run failed, and a request that failed outright, all identically: an
 * empty-state panel explaining an absent feature costs a real moment of "why is
 * this broken?" while advertising machinery nobody asked about (project spec
 * §11). `DiscoverPage` applies the same rule one level up and withholds the
 * tab itself, so this panel is normally unreachable when it is empty.
 *
 * The label is "My Recommendations", not "Because you watched" — the latter
 * promises a per-show causal link the reason does not deliver, since the model
 * reasons over the whole profile.
 *
 * There is no sort control, no filter and no pagination: the ranking is the
 * model's, and letting users re-sort discards the only ordering that carries
 * information. The list is rendered exactly as the server sent it — the cap and
 * the `adult` / `deleted_upstream_at` filters are the server's (NEU-1112
 * contract §4). It legitimately shrinks as the user acts on it: the server
 * suppresses a suggestion once the viewer has a record for that show
 * (NEU-1175), and the stored set is never backfilled from an older one.
 *
 * **The one-line sign-off is mount-scoped, and is not the empty state §11
 * forbids.** That rule is about a user meeting machinery they have never had,
 * where an explanation costs a real moment of "why is this broken?". This line
 * is reachable only by a user who just used up every suggestion they were
 * given in this very mount, and it explains something they spent. Every cold
 * path — never generated, below the floor, a failed Sunday run, a failed
 * request — still renders nothing at all, and `DiscoverPage` still withholds
 * the tab for them. "Sunday" is accurate: the weekly pass is a Coolify
 * scheduled task running Sundays.
 */
export function RecommendedForYou() {
  const { data } = useRecommendations();
  const recommendations = data?.recommendations ?? [];
  // A ref rather than state: nothing re-renders *because* of the latch — the
  // render that empties the list is the one that reads it.
  const hadRows = useRef(false);
  if (recommendations.length > 0) hadRows.current = true;

  if (recommendations.length === 0) {
    if (!hadRows.current) return null;
    return (
      <section aria-labelledby="my-recommendations-heading" className="flex flex-col gap-2">
        <h2 id="my-recommendations-heading" className="sr-only">
          My Recommendations
        </h2>
        <p className="text-muted-foreground">
          That&rsquo;s everything for this week &mdash; new recommendations on Sunday.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="my-recommendations-heading" className="flex flex-col gap-2">
      {/* The tab label carries the visible title; this stays for the document
        outline and screen readers, matching Trending and Most Anticipated. */}
      <h2 id="my-recommendations-heading" className="sr-only">
        My Recommendations
      </h2>
      {/* The one surface that passes `addable`: making the grid a place a
        suggestion can be acted on is the shortest path between seeing one and
        taking it, and it is what the refetch above exists to serve. Every
        other grid passes nothing and renders no control. */}
      <ShowGrid shows={recommendations} addable />
    </section>
  );
}
