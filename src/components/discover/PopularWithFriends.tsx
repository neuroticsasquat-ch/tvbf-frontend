import { Link } from "react-router";

import { usePopularWithFriends } from "@/api/me";
import { ShowGrid } from "@/components/ShowGrid";

/** The Popular with Friends tab of the Discover page (NEU-1500).
 *
 * The shows the viewer's accepted connections have been active on over the
 * last two weeks, ranked by how many of them — rendered exactly in the order
 * the server sent, with no sort control, no filter and no pagination (project
 * spec §6.1, §7). A show already in My Shows is marked by the card and never
 * dropped.
 *
 * **Unlike Trending, the empty list is reported rather than hidden**, because
 * here it is a fact about the viewer's friends worth stating (§6.3). The
 * envelope's `connection_count` tells the two cases apart, so this component
 * needs no second request and no rule of its own: nobody to hear from gets a
 * way to fix that, nobody saying anything gets told so. `ShowGrid`'s own empty
 * copy ("No shows match your filters.") is wrong for both, so it is never
 * handed an empty array.
 *
 * Loading and error render nothing at all, matching Trending: the tab stays,
 * the pane is empty.
 */
export function PopularWithFriends() {
  const { data } = usePopularWithFriends();
  if (!data) return null;

  return (
    <>
      {/* The tab label carries the visible title; this stays for the document
        outline and screen readers, matching the sibling tabs. */}
      <h2 className="sr-only">Popular with Friends</h2>
      {data.connection_count === 0 ? (
        <p className="text-muted-foreground">
          <Link to="/friends" className="text-foreground underline">
            Connect with friends
          </Link>{" "}
          to see what they're watching.
        </p>
      ) : data.shows.length === 0 ? (
        <p className="text-muted-foreground">Nothing from your friends in the last two weeks.</p>
      ) : (
        <ShowGrid shows={data.shows} />
      )}
    </>
  );
}
