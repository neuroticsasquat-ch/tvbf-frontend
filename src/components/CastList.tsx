import { useState } from "react";
import { useShowCast, useShowGuestCast } from "@/api/shows";
import type { CastMember } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { PersonChip } from "@/components/PersonChip";
import { episodeCountLabel } from "@/lib/episodeCount";

/** Cast entries shown before the first "Show more". */
const COLLAPSED_COUNT = 12;

/** Entries each "Show more" adds (NEU-1512). Paged rather than all-at-once
 * because a show's guest stars are unbounded — Law & Order has 11,517 — and
 * mounting them in one click freezes the tab. */
const PAGE_SIZE = 48;

interface CastListProps {
  entries: CastMember[];
  /** Section heading — "Cast" or "Guest stars" for a show, "Guest cast" for an
   * episode, "Regular cast" or "Guest stars" for a season. */
  title: string;
  /** Must be unique on the page; it wires the heading to its section. */
  headingId: string;
  /** Hides the heading visually but not from assistive tech. Set where a tab
   * label already carries the same title and count, as on show pages. */
  headingHidden?: boolean;
  /** `h3` where the list sits under a panel heading of its own — the season
   * page's Cast panel holds two lists. */
  headingLevel?: "h2" | "h3";
}

/** Renders a list of cast credits. Presentational on purpose: every cast route
 * carries the identical payload, so all of them feed this.
 *
 * The "N episodes" meta follows the payload rather than a prop: the routes
 * whose count means nothing — a season's regulars, an episode's guests — send
 * null, and null prints nothing. */
export function CastList({
  entries,
  title,
  headingId,
  headingHidden = false,
  headingLevel: Heading = "h2",
}: CastListProps) {
  const [shown, setShown] = useState(COLLAPSED_COUNT);

  // 27% of shows have zero cast, and 96% of episodes have zero guest cast.
  // That is the normal case, not an error state — render nothing at all rather
  // than an empty header.
  if (entries.length === 0) return null;

  // Never re-sort here. Show cast arrives in descending `episode_count` since
  // NEU-1047, and guest cast in the episode's own credit sequence. A
  // client-side sort on `episode_count` would not just duplicate the server's
  // job, it would silently reshuffle the guest cast, which carries no count.
  const visible = entries.slice(0, shown);

  return (
    <section aria-labelledby={headingId}>
      <Heading
        id={headingId}
        className={headingHidden ? "sr-only" : "mb-3 text-lg font-semibold"}
      >
        {title} <span className="font-normal text-muted-foreground">({entries.length})</span>
      </Heading>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((entry, i) => (
          // Credit rows carry no upstream id and upstream does emit repeat
          // person/character pairs, so the index is part of the key.
          <li key={`${entry.person.id}-${entry.character.id}-${i}`}>
            <PersonChip
              person={entry.person}
              detail={entry.voice ? `${entry.character.name} (voice)` : entry.character.name}
              meta={episodeCountLabel(entry.episode_count)}
            />
          </li>
        ))}
      </ul>
      {entries.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE_SIZE)}
          // The season page renders two lists in one panel, so the name says
          // which one grows. The visible text stays a prefix (WCAG 2.5.3).
          aria-label={`Show more ${title.toLowerCase()} (${visible.length} of ${entries.length} shown)`}
          className="mt-3 rounded text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Show more
        </button>
      )}
    </section>
  );
}

/** A show's regular cast, fetched and rendered. */
export function ShowCastList({
  showId,
  headingHidden = false,
}: {
  showId: number;
  headingHidden?: boolean;
}) {
  const { data, isError, error, refetch } = useShowCast(showId);

  // A failed request must not look like the (very common) empty case.
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <CastList
      entries={data ?? []}
      title="Cast"
      headingId="cast-heading"
      headingHidden={headingHidden}
    />
  );
}

/** A show's guest stars — every cast credit that is not a regular one. */
export function ShowGuestCastList({
  showId,
  headingHidden = false,
}: {
  showId: number;
  headingHidden?: boolean;
}) {
  const { data, isError, error, refetch } = useShowGuestCast(showId);

  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return (
    <CastList
      entries={data ?? []}
      title="Guest stars"
      headingId="guest-stars-heading"
      headingHidden={headingHidden}
    />
  );
}
