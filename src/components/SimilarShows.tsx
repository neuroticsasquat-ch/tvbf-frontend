import { useSimilarShows } from "@/api/shows";
import { ShowGrid } from "@/components/ShowGrid";

/** The "Similar" tab of a show page (NEU-1054).
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
 * It is a tab beside seasons, cast and crew rather than a section below them.
 * The tab strip does not shift under the reader's cursor as a result: the tab
 * is always rendered, and is *disabled* when the show has nothing to put in
 * it, exactly as the cast and crew tabs already are.
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
      {/* The tab label carries the visible title and count; this stays for the
        document outline and screen readers, matching the seasons panel. */}
      <h2 id="similar-shows-heading" className="sr-only">
        Similar
      </h2>
      <ShowGrid shows={shows} />
    </section>
  );
}
