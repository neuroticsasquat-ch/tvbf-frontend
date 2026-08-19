import { Link } from "react-router";
import type { ShowSummary } from "@/api/types";
import { RatingBadge } from "@/components/RatingBadge";
import { ShowPoster } from "@/components/ShowPoster";
import { tenPointToFiveStar } from "@/lib/rating";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

/** Search results at list density — **the same facts its grid carries**, plus
 * the ownerless catalog metadata a ~97px card physically cannot hold
 * (NEU-1188 AC 1).
 *
 * A view toggle is a density choice: ownerless metadata may thin out as density
 * rises, per-person facts may not. This row was the inverse — network, status,
 * language and genres, and **no rating and no library mark of any kind**, so
 * switching to it lost the answer to "do I already have this?" on the one
 * surface where that is the question being asked. NEU-1186 landed the mark on
 * the grid and deferred the row here explicitly, rather than giving it a mark
 * and still no rating.
 *
 * `shows` widens to a `ShowSummary` carrying an optional `in_my_shows`, exactly
 * as `ShowGrid` does, so `BrowseShow[]` passes through unchanged and a payload
 * without the field renders a row without the mark.
 *
 * **The row is two links, not one.** It was a single `<Link>` over the whole
 * row, which cannot hold a poster with badges: `ShowPoster` owns its own link
 * and an `<a>` inside an `<a>` is invalid. So the poster and the name are each
 * a link to the same show — the shape both library rows already have, and the
 * seam NEU-1190 §1 will use to make it one tab stop again.
 *
 * Placement is stated nowhere here: the mark's corner and the viewer's rating's
 * corner are `ShowPoster`'s (NEU-1183 §3.4), and the aggregate goes inline
 * beside the title because another crowd's number never occupies a corner
 * (§3.5) — the same three positions `ShowCard` gets by the same rule.
 */
export function ShowList({ shows }: { shows: (ShowSummary & { in_my_shows?: boolean })[] }) {
  if (shows.length === 0) {
    return <p className="py-16 text-center text-muted-foreground">No shows match your filters.</p>;
  }
  return (
    <ul className="space-y-3">
      {shows.map((show) => {
        const aggregate = tenPointToFiveStar(show.rating_average);
        return (
          <li
            key={show.id}
            className="border border-border rounded p-3 flex items-center gap-4 hover:bg-accent"
          >
            <ShowPoster
              to={`/shows/${show.id}`}
              src={show.image_medium}
              linkLabel={show.name}
              size="row"
              inMyShows={show.in_my_shows}
              ownRating={show.my_rating}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg mb-1 flex items-baseline gap-2 flex-wrap">
                <Link to={`/shows/${show.id}`} className="hover:underline min-w-0 break-words">
                  {show.name}
                </Link>
                <span className="font-normal text-muted-foreground">({year(show.premiered)})</span>
                {aggregate != null && (
                  <RatingBadge kind="aggregate" crowdName="TMDB" value={aggregate} />
                )}
              </p>
              {show.matched_aka && (
                <p className="text-xs text-muted-foreground leading-tight italic">
                  Matched: {show.matched_aka}
                </p>
              )}
              <p className="text-xs text-muted-foreground leading-tight">
                {[show.network?.name, show.status, show.language].filter(Boolean).join(" · ")}
              </p>
              {show.genres.length > 0 && (
                <p className="text-xs text-muted-foreground leading-tight">
                  {show.genres.join(", ")}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
