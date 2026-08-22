import type { ReactNode } from "react";
import { Link } from "react-router";

import type { EpisodeOut, ShowSummary } from "@/api/types";
import { ShowPoster } from "@/components/ShowPoster";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatAirdate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

/** One "next episode of a show you track" row, shared by Watch Next and
 * Upcoming.
 *
 * **The picture is the show poster, drawn by `ShowPoster`** (NEU-1189 AC 3).
 * The two pages disagreed: Watch Next used a 16:9 episode still, Upcoming the
 * 210:295 poster every other surface uses. The still is the more appealing
 * choice on paper — it is an episode row — and it was measured before being
 * rejected. `catalog.episode.still_path` is populated on 6,394 of 3,539,209
 * mirrored episodes (0.18%) and on **0 of the 20,850 episodes belonging to a
 * show any user tracks** (2026-08-18). These two pages list nothing else, so
 * the still was the grey `Tv` placeholder on every row Watch Next could
 * produce, and it spent 128px of a 375px viewport being empty where the poster
 * spends 64px carrying the show's actual art. The gap is upstream's, not a
 * mirroring one — the ingest already writes `still_path` from TMDB's payload
 * (`tmdb/upsert.py`), TMDB simply has no stills for most series. If that ever
 * changes, this is the decision to revisit, and the query above is how.
 *
 * **Two links, and the poster's is the show's.** `ShowPoster` owns its own
 * `Link`, so the poster cannot sit inside the row's episode link — a link
 * inside a link is invalid. Given it is a separate link either way, it points
 * at the show, because its accessible name is the show's name and a link
 * announced as "Ted Lasso" that lands on an episode page is a defect. The row's
 * text is the episode's link.
 *
 * **Both links stay, and this row is deliberately exempt from NEU-1190 §1.2.**
 * That ticket collapses the row surfaces whose poster and text are two links
 * with the *same* accessible name to the *same* destination — a second tab stop
 * that offers nothing. This row is not one of them: its two links are named
 * differently and land differently, which is a row offering two things rather
 * than a duplicate. Collapsing it would delete the only keyboard route from
 * here to the show page in exchange for a tab stop that confused nobody, so
 * this poster keeps its `to` / `linkLabel` while the four duplicate rows drop
 * theirs. (An earlier revision of this docstring said §1 would "collapse [the
 * extra tab stop] across all of them at once"; that was wrong about what the
 * ticket does, and correcting it is part of the ticket.)
 */
export function EpisodeRow({
  show,
  episode,
  action,
}: {
  show: ShowSummary;
  episode: EpisodeOut;
  /** Trailing control, e.g. Watch Next's watched checkbox. Upcoming passes
   * none — an episode that has not aired cannot be marked watched. */
  action?: ReactNode;
}) {
  return (
    <li className="border border-border rounded p-3 flex items-center gap-3 sm:gap-4 hover:bg-accent">
      <ShowPoster
        to={`/shows/${show.id}`}
        src={show.image_medium}
        linkLabel={show.name}
        size="row"
      />
      <Link to={`/episodes/${episode.id}`} className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground leading-tight truncate">
          {show.name}
          {show.premiered && (
            <span className="font-normal text-muted-foreground">
              {" "}
              ({show.premiered.slice(0, 4)})
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground leading-tight">
          S{episode.season}E{episode.number}
        </p>
        {episode.name && (
          <p className="text-sm text-foreground leading-tight truncate">{episode.name}</p>
        )}
        {(episode.airdate || episode.runtime) && (
          <p className="text-xs text-muted-foreground leading-tight">
            {episode.airdate ? formatAirdate(episode.airdate) : ""}
            {episode.airdate && episode.runtime ? " · " : ""}
            {episode.runtime ? `${episode.runtime} min` : ""}
          </p>
        )}
      </Link>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}
