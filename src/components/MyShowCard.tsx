import type { MyShowEntry } from "@/api/types";
import { MyShowsButton } from "@/components/MyShowsButton";
import { OwnerFacts } from "@/components/OwnerFacts";
import { ShowPoster } from "@/components/ShowPoster";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { isEndedStatus } from "@/components/home/filterTypes";
import type { RatingOwner } from "@/lib/rating";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

export function MyShowCard({
  entry,
  ratingOwner,
  inMyShows,
  removable,
  onRemoved,
}: {
  entry: MyShowEntry;
  /** Whose library this card is drawn from — the viewer's own, or a named
   * friend's. Required with no default: this card is shared by My Shows and by
   * a friend's library, and every fact on it except the show itself belongs to
   * whoever that is. A default of "yours" is what labelled a friend's rating
   * "Your rating" (NEU-1181 §6.2). */
  ratingOwner: RatingOwner;
  /** Whether this show is in **the viewer's** My Shows — never the owner's.
   * The mark is always a claim about the viewer's own library (§6.5), which is
   * why it does not travel with `ratingOwner`.
   *
   * Required, where it used to default to `true` (NEU-1187 §3.3). That default
   * is what let the always-true badge exist: on the viewer's own Active tab
   * every card is in My Shows by definition, so the mark asserted nothing and
   * cost a corner. Both views now ask `callerPosterMark`, which answers `false`
   * for self mode, and no caller wants the default any more. */
  inMyShows: boolean;
  /** Opt-in: draw the compact remove chip in the poster's bottom-right corner.
   * A flat boolean on `ShowCard`'s `addable` / `dismissible` precedent — the
   * card builds the control itself rather than taking a `ReactNode`, which is
   * the whole point of that seam: an affordance belonging to one surface
   * arrives as an opt-in, not as a hole any caller can fill. Only the viewer's
   * own My Shows · Active passes it (NEU-1187 §3.3). */
  removable?: boolean;
  /** Reports a landed removal back to the surface, so it can move focus once
   * this card unmounts. One function reference for every card; the card hands
   * its own id back (NEU-1187 §3.5). */
  onRemoved?: (showId: number) => void;
}) {
  // Same predicate as the list view (NEU-101 decision 2): show is over AND
  // the user is fully caught up.
  const isFinished =
    entry.aired_episode_count > 0 &&
    entry.watched_episode_count >= entry.aired_episode_count &&
    isEndedStatus(entry.show.status);

  return (
    <div className="relative overflow-hidden rounded border border-border bg-background transition hover:border-foreground">
      <ShowPoster
        to={`/shows/${entry.show.id}`}
        src={entry.show.image_medium}
        linkLabel={entry.show.name}
        size="card"
        inMyShows={inMyShows}
        // Only the viewer's own rating may occupy a poster corner. A friend's
        // goes to `OwnerFacts` below, under their name (NEU-1182 §3.5) — and
        // the prop takes a bare number, so it could not go here anyway.
        ownRating={ratingOwner.kind === "own" ? entry.my_rating : null}
        control={
          // The `ratingOwner` half of the guard is what makes the literal
          // `inMyShows` below safe. This card is shared with a *friend's*
          // library, where the entry is in **their** My Shows and says nothing
          // about the viewer's — so a `removable` passed there would draw
          // "Remove … from My Shows" over a show the viewer may never have had,
          // and activating it would DELETE one they do. Deriving the control's
          // presence from whose library the card is drawn from makes that
          // impossible rather than merely commented, which matters because D7
          // hands this card to NEU-1188 and a friend-mode control is exactly
          // what that ticket adds — in an action row, and needing the caller's
          // own relationship, which this card is not given.
          removable && ratingOwner.kind === "own" ? (
            // `true`, not this card's `inMyShows`: that prop is the *poster
            // mark*, which is a claim about the viewer's library and is
            // deliberately `false` on the one surface that passes `removable`.
            // What the control needs is whether the entry is tracked, and on a
            // card drawn from the viewer's own library the entry's presence is
            // that answer.
            <MyShowsButton
              showId={entry.show.id}
              showName={entry.show.name}
              inMyShows
              variant="compact"
              onRemoved={onRemoved}
            />
          ) : undefined
        }
      >
        <div className="p-1.5">
          <h3 className="truncate text-xs font-medium leading-tight group-hover:underline">
            {entry.show.name}
          </h3>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {year(entry.show.premiered)}
          </p>
          {!isFinished && entry.aired_episode_count > 0 && (
            <WatchProgressBar
              watched={entry.watched_episode_count}
              aired={entry.aired_episode_count}
              upcoming={entry.upcoming_episode_count}
              barOnly
            />
          )}
          <OwnerFacts
            owner={ratingOwner}
            layout="stacked"
            status={isFinished ? "finished" : null}
            progress={
              !isFinished && entry.aired_episode_count > 0
                ? { watched: entry.watched_episode_count, aired: entry.aired_episode_count }
                : null
            }
            // The viewer's own rating has a home of its own on this card — the
            // poster corner above. Only a friend's lands in the group.
            rating={ratingOwner.kind === "own" ? null : entry.my_rating}
            // The card has never carried a date, in either mode: it is the
            // densest surface in the app and the fraction is what a reader
            // compares.
            lastWatchedAt={null}
          />
          {!isFinished && entry.upcoming_episode_count > 0 && (
            <p className="text-[10px] text-muted-foreground leading-tight">
              {entry.upcoming_episode_count} upcoming
            </p>
          )}
        </div>
      </ShowPoster>
    </div>
  );
}
