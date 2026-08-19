import { Link } from "react-router";
import type { ShowSummary } from "@/api/types";
import { MyShowsButton } from "@/components/MyShowsButton";
import { RatingBadge } from "@/components/RatingBadge";
import { ShowPoster } from "@/components/ShowPoster";
import { languageName } from "@/lib/language";
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
 * **The row is one link, and it is the name.** It was a single `<Link>` over
 * the whole row, which cannot hold a poster with badges: `ShowPoster` owns its
 * own link and an `<a>` inside an `<a>` is invalid. NEU-1188 therefore made the
 * poster and the name two links to one show — two tab stops with the same
 * accessible name and the same destination, which NEU-1190 §1 collapses by
 * having the poster render presentationally. `ShowPoster` keeps drawing the
 * badges and their labels; only its link goes.
 *
 * **The language is a display name, never the code** (NEU-1190 §3). Since
 * NEU-1047 `show.language` carries `original_language`, an ISO 639-1 code, and
 * this line printed it verbatim — `NBC · Ended · en`. `languageName` maps it,
 * and answers null for a code it cannot map (TMDB's non-standard `cn` is the
 * known one), which `filter(Boolean)` then drops: the segment is absent rather
 * than raw, with the surrounding separators intact.
 *
 * Placement is stated nowhere here: the mark's corner and the viewer's rating's
 * corner are `ShowPoster`'s (NEU-1183 §3.4), and the aggregate goes inline
 * beside the title because another crowd's number never occupies a corner
 * (§3.5) — the same three positions `ShowCard` gets by the same rule.
 *
 * `addable` mirrors `ShowGrid`'s prop exactly (NEU-1176, NEU-1192): an opt-in
 * boolean defaulting to no control, so the component stays shared and every
 * caller that says nothing keeps the default. Search is the one surface that
 * passes it — membership genuinely varies there, which is the whole reason the
 * mark is on the row, so adding is possible and the variant is the labelled
 * action-row chip rather than the poster overlay (NEU-1187 §3.1: the
 * *position* is what says whether adding is possible).
 *
 * The action-row container is verbatim the one every other row control in the
 * app already uses — `WatchedRow` and the friend Active row — `pt-1` included.
 * A row control that placed itself differently from those would be a new
 * inconsistency landed inside the UI-consistency milestone.
 */
export function ShowList({
  shows,
  addable,
}: {
  shows: (ShowSummary & { in_my_shows?: boolean })[];
  addable?: boolean;
}) {
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
            {/* Presentational: the row's name below is the single link to
              the show (NEU-1190 §1). The badges keep their labels — the
              poster simply stops being a second, identically-named route to
              the destination the title already names. */}
            <ShowPoster
              src={show.image_medium}
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
                {[show.network?.name, show.status, languageName(show.language)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {show.genres.length > 0 && (
                <p className="text-xs text-muted-foreground leading-tight">
                  {show.genres.join(", ")}
                </p>
              )}
              {addable && (
                // The chip reads the row's own `in_my_shows`, the same field
                // the poster's mark reads, so the two cannot disagree about
                // one show — and `["shows"]` is patched optimistically by both
                // mutations, so they do not disagree in flight either
                // (`api/me.ts`, NEU-1192 §3.3). The fallback to `false`
                // matches `ShowCard`'s: the field is optional on the way in,
                // so a payload without it renders a row offering to add.
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <MyShowsButton
                    showId={show.id}
                    showName={show.name}
                    inMyShows={show.in_my_shows ?? false}
                  />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
