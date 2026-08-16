import { useAnticipated } from "@/api/shows";
import { ShowGrid } from "@/components/ShowGrid";

/** The Most Anticipated tab of the Discover page (NEU-1060).
 *
 * **The premiere date is the surface.** Every entry premieres inside the
 * server's window, so the year alone separates almost nothing — an anticipated
 * list without dates is a popularity list. The cards therefore render the full
 * date, and an undated show reads "TBA" rather than a dash that would look
 * like a rendering failure. The server never sends one (NEU-1059 contract §5),
 * so that is the card declining to trust the contract, not a case expected
 * here.
 *
 * Renders nothing at all when the list is empty — no empty state, no error, no
 * spinner, matching `Trending`. Empty is `200 []` and means the mirror holds no
 * future-dated show at all (contract §4).
 *
 * **A failed request renders as the same empty tab, deliberately.** The
 * contract keeps `200 []` and a 5xx distinguishable by status code so a client
 * *may* tell them apart; this one declines to, because a Discover tab is a
 * browsing surface the user did not ask a question of, and an error banner on
 * one of two tabs is louder than the thing that failed. `Trending` made the
 * same call, and two sibling tabs disagreeing about it would read as a bug
 * rather than as a decision.
 *
 * **There is no staleness handling and there must not be.** The list is a live
 * query rather than a snapshot, so a show cannot linger after it premieres and
 * the payload carries no timestamp a cutoff could be built from (contract §3).
 *
 * No sort, no filter, no pagination: popularity within the window is the only
 * ordering that carries information, and the length is the server's. Shows
 * already in My Shows are marked by the card and never dropped — a list of
 * what is coming is a claim about the world, and seeing something you are
 * already waiting for in it is a feature (contract §5).
 */
export function Anticipated() {
  const { data } = useAnticipated();
  const shows = data ?? [];
  if (shows.length === 0) return null;

  return (
    <>
      {/* The tab label carries the visible title; this stays for the document
        outline and screen readers, matching Trending. */}
      <h2 className="sr-only">Most Anticipated</h2>
      <ShowGrid shows={shows} premiereDisplay="date" />
    </>
  );
}
