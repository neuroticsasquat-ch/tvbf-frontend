import type { MyShowEntry } from "@/api/types";
import { MuteShowButton } from "@/components/MuteShowButton";
import { MyShowsButton } from "@/components/MyShowsButton";
import { OwnerFacts } from "@/components/OwnerFacts";
import { RemoveWatchHistoryButton } from "@/components/RemoveWatchHistoryButton";
import { ShowPoster } from "@/components/ShowPoster";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { isEndedStatus } from "@/components/home/filterTypes";
import { CallerProgressNote } from "@/components/library/LibraryRowIndicators";
import type { CallerRelationship } from "@/components/library/callerLibrary";
import type { RatingOwner } from "@/lib/rating";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

/** A grid card for one library entry — the dense half of a library tab, and
 * **carrying the same facts and controls its list row does** (NEU-1188).
 *
 * A view toggle is a density choice: ownerless catalog metadata may thin out as
 * density rises, per-person facts and controls may not. Two of this card's
 * three gaps were the ones that rule catches hardest — the Watched grid could
 * not add a show to My Shows *at all*, and a friend's grid offered neither the
 * button nor the `You: x/y` comparison its rows carry. The third was
 * `lastWatchedAt={null}`, hard-coded here as "the densest surface in the app",
 * which is the argument the rule rejects: it is the Watched tab's own default
 * sort key, so hiding it in one of two views is its own small defect.
 */
export function MyShowCard({
  entry,
  ratingOwner,
  inMyShows,
  callerRelationship,
  historyRemovable,
  mutable,
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
  /** The **viewer's own** relationship to this show, resolved by the surface
   * (`activeCallerRelationship` / `watchedCallerRelationship`). Present → the
   * card draws an action row carrying the labelled add/remove button and, when
   * the viewer has watched anything, the `You: x/y` comparison — the same pair,
   * from the same resolver, that the list row renders (NEU-1188 AC 2/3).
   *
   * A flat resolved value rather than a `ReactNode` slot, on `historyRemovable`'s
   * precedent: the card builds the control itself, so an affordance belonging
   * to one surface arrives as an opt-in rather than as a hole any caller can
   * fill with a fifth drawing of one affordance.
   *
   * **Absent is the Active tab's self mode**, where every entry is in My Shows
   * by definition — there is no add to offer and nobody to compare against, and
   * no removal either: that tab's removal path is the show page (NEU-1511). */
  callerRelationship?: CallerRelationship | null;
  /** Opt-in: draw the compact **watch-history** removal in the poster's
   * bottom-right corner. A flat boolean on `ShowCard`'s `addable` /
   * `dismissible` precedent — the card builds the control itself rather than
   * taking a `ReactNode`, which is the whole point of that seam: an affordance
   * belonging to one surface arrives as an opt-in, not as a hole any caller can
   * fill. Only Watched passes it (NEU-1193); it is the one corner control this
   * card draws. The viewer's own Active tab used to pass a sibling `removable`
   * for a compact My Shows removal, and NEU-1511 took it away: a remove-only
   * chip over the card's link is what got tapped by mistake. */
  historyRemovable?: boolean;
  /** Opt-in: draw the compact push-notification mute toggle in the action row
   * (NEU-1495). Only the viewer's own My Shows · Active passes it — a Watched
   * entry need not be in My Shows at all, so there is no row to mute — and,
   * like `historyRemovable`, it is honoured only when `ratingOwner.kind === "own"`: a
   * friend's entry carries the friend's flag, not the viewer's.
   *
   * The action row rather than a poster corner, because the corners hold
   * controls that can only remove (NEU-1187 §3.1) and a mute flips both ways. */
  mutable?: boolean;
  /** Reports a landed watch-history removal back to the surface, so it can
   * move focus once this card unmounts. One function reference for every card;
   * the card hands its own id back (NEU-1187 §3.5). */
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
          // The `ratingOwner` half of the guard: this card is shared with a
          // *friend's* library, whose Watched card carries the friend's history,
          // which is not the viewer's to delete. Deriving the control's presence
          // from whose library the card is drawn from makes that impossible
          // rather than merely commented.
          historyRemovable && ratingOwner.kind === "own" ? (
            <RemoveWatchHistoryButton
              showId={entry.show.id}
              showName={entry.show.name}
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
            // A per-person fact, so it is in both views or neither (NEU-1188
            // AC 7). It was `null` here on the grounds that this is the densest
            // surface and the fraction is what a reader compares — which is an
            // argument for *thinning*, and this fact is not ownerless catalog
            // metadata. On Watched it is also the tab's default sort key.
            lastWatchedAt={entry.last_watched_at}
          />
          {!isFinished && entry.upcoming_episode_count > 0 && (
            <p className="text-[10px] text-muted-foreground leading-tight">
              {entry.upcoming_episode_count} upcoming
            </p>
          )}
        </div>
      </ShowPoster>
      {mutable && ratingOwner.kind === "own" && (
        // Outside the poster for the same sibling-not-descendant reason as the
        // row below. Compact, because a ~97px card has no room for the label.
        <div className="flex justify-end px-1.5 pb-1">
          <MuteShowButton
            showId={entry.show.id}
            showName={entry.show.name}
            muted={entry.muted ?? false}
            variant="compact"
          />
        </div>
      )}
      {callerRelationship && (
        // Outside the poster, so the button is a sibling of its link rather
        // than a descendant — the same structural reason `ShowCard`'s `addable`
        // row sits here. The pair wraps rather than shrinking: at 375px a card
        // is ~97px inside its padding and the labelled button alone is ~78px,
        // so the comparison takes its own line above it. That is the labelled
        // variant's cost, and it is the right one to pay here — adding *is*
        // possible on both surfaces that pass this, which is what the action
        // row's position means (NEU-1187 §3.1).
        <div className="flex flex-col items-end gap-1 px-1.5 pb-1.5">
          <CallerProgressNote progress={callerRelationship.progress} size="card" />
          <MyShowsButton
            showId={entry.show.id}
            showName={entry.show.name}
            inMyShows={callerRelationship.inMyShows}
          />
        </div>
      )}
    </div>
  );
}
