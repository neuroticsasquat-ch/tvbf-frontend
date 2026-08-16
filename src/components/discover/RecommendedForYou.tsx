import { useRecommendations } from "@/api/me";
import { ShowGrid } from "@/components/ShowGrid";

/** The "Recommended for you" section of the Discover page (NEU-1114).
 *
 * Renders nothing at all when there is nothing to show — no empty state, no
 * "add more shows" nudge, no spinner, no error. That covers a user whose set
 * has never been generated, one below the generation floor, one whose Sunday
 * run failed, and a request that failed outright, all identically: an
 * empty-state panel explaining an absent feature costs a real moment of "why is
 * this broken?" while advertising machinery nobody asked about (project spec
 * §11).
 *
 * The heading is "Recommended for you", not "Because you watched" — the latter
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
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Recommended for you</h2>
      <ShowGrid shows={recommendations} />
    </section>
  );
}
