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
 * contract §4).
 */
export function RecommendedForYou() {
  const { data } = useRecommendations();
  const recommendations = data?.recommendations ?? [];
  if (recommendations.length === 0) return null;

  return (
    <section aria-labelledby="my-recommendations-heading" className="flex flex-col gap-2">
      {/* The tab label carries the visible title; this stays for the document
        outline and screen readers, matching Trending and Most Anticipated. */}
      <h2 id="my-recommendations-heading" className="sr-only">
        My Recommendations
      </h2>
      <ShowGrid shows={recommendations} />
    </section>
  );
}
