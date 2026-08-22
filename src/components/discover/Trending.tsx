import { useTrending } from "@/api/shows";
import { ShowGrid } from "@/components/ShowGrid";

/** The Trending tab of the Discover page (NEU-1057).
 *
 * Renders nothing at all when the snapshot is empty — no empty state, no
 * error, no spinner. Four situations produce that empty list and the payload
 * is deliberately shaped so this component cannot tell them apart: the job has
 * never run, the snapshot is past the server's seven-day cutoff, the last run
 * resolved nothing, or every entry was filtered as adult or tombstoned
 * (NEU-1056 contract §4). **The user is never shown the word "stale."**
 *
 * There is no sort control, no filter and no pagination: TMDB's ranking is the
 * only ordering here that carries information, and the snapshot is at most
 * twenty rows by construction, so the list is rendered exactly as the server
 * sent it.
 *
 * Shows already in My Shows are marked by the card and never dropped —
 * trending is a claim about the world, and seeing your own show in it is a
 * feature (contract §5).
 */
export function Trending() {
  const { data } = useTrending();
  const shows = data?.shows ?? [];
  if (shows.length === 0) return null;

  return (
    <>
      {/* The tab label carries the visible title; this stays for the document
        outline and screen readers, matching ShowDetailPage's tabs. */}
      <h2 className="sr-only">Trending</h2>
      <ShowGrid shows={shows} />
    </>
  );
}
