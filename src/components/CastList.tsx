import { useState } from "react";
import { useShowCast } from "@/api/shows";
import type { CastMember } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { PersonChip } from "@/components/PersonChip";

/** Cast entries shown before the "Show all" affordance. Cast is unbounded —
 * The Simpsons has 1,420 entries — so the full list is opt-in. */
const COLLAPSED_COUNT = 12;

/** "12 episodes" for a credit that carries a count, nothing for one that
 * doesn't. Zero reads as missing data rather than as a fact worth printing, and
 * a negative count is not a thing the API can mean. */
function episodeCountLabel(count: number | null | undefined): string | undefined {
  if (typeof count !== "number" || count < 1) return undefined;
  return `${count} ${count === 1 ? "episode" : "episodes"}`;
}

interface CastListProps {
  entries: CastMember[];
  /** Section heading — "Cast" for a show, "Guest cast" for an episode. */
  title: string;
  /** Must be unique on the page; it wires the heading to its section. */
  headingId: string;
  /** Hides the heading visually but not from assistive tech. Set where a tab
   * label already carries the same title and count, as on show pages. */
  headingHidden?: boolean;
}

/** Renders a list of cast credits. Presentational on purpose: show cast and
 * episode guest cast carry the identical payload, so both feed this. */
export function CastList({ entries, title, headingId, headingHidden = false }: CastListProps) {
  const [expanded, setExpanded] = useState(false);

  // 27% of shows have zero cast, and 96% of episodes have zero guest cast.
  // That is the normal case, not an error state — render nothing at all rather
  // than an empty header.
  if (entries.length === 0) return null;

  // Never re-sort here. Show cast arrives in descending `episode_count` since
  // NEU-1047, and guest cast in the episode's own credit sequence. A
  // client-side sort on `episode_count` would not just duplicate the server's
  // job, it would silently reshuffle the guest cast, which carries no count.
  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={headingHidden ? "sr-only" : "mb-3 text-lg font-semibold"}>
        {title} <span className="font-normal text-muted-foreground">({entries.length})</span>
      </h2>
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
      {entries.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 rounded text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : `Show all ${entries.length}`}
        </button>
      )}
    </section>
  );
}

/** Show-level cast, fetched and rendered. */
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
