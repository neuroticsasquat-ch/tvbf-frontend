import { useSimilarShows } from "@/api/shows";
import { ShowGrid } from "@/components/ShowGrid";

/** The "More like this" section of a show page (NEU-1054).
 *
 * Renders nothing at all when there is nothing to show — no empty state, no
 * "no similar shows found", no spinner, no error. A show with no
 * recommendations is roughly 8% of the long tail, so that is the common path
 * rather than an edge case, and a visible "we have nothing for you" on that
 * many pages reads as a broken feature (project spec §2).
 *
 * The same rule covers the in-flight and failed requests: `data` is undefined
 * until the list resolves, so the heading never appears and then disappears.
 *
 * It sits below the seasons/cast/crew tabs rather than inside them as a fourth
 * tab: a tab that is sometimes absent shifts the tab strip under the reader's
 * cursor, where a section that is sometimes absent only ends the page earlier.
 *
 * `ShowCard` / `ShowGrid` are reused unchanged — the route serves the same
 * `ShowSummary` browse serves — so a card links through to the show page,
 * which is where My Shows is joined, exactly as every other grid in the app
 * does.
 */
export function SimilarShows({ showId }: { showId: number }) {
  const { data } = useSimilarShows(showId);
  const shows = data ?? [];
  if (shows.length === 0) return null;

  return (
    <section aria-labelledby="similar-shows-heading">
      <h2 id="similar-shows-heading" className="mb-3 text-lg font-semibold">
        More like this
      </h2>
      <ShowGrid shows={shows} />
    </section>
  );
}
