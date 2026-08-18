import type { MyShowEntry } from "@/api/types";
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
  inMyShows = true,
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
   * why it does not travel with `ratingOwner`. On the Active tab of your own
   * library every card is in My Shows by definition; elsewhere it varies. */
  inMyShows?: boolean;
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
