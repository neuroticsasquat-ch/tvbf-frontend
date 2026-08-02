import { useState } from "react";
import { useShowCast } from "@/api/shows";
import { ErrorState } from "@/components/ErrorState";
import { PersonChip } from "@/components/PersonChip";

/** Cast entries shown before the "Show all" affordance. Cast is unbounded —
 * The Simpsons has 1,420 entries — so the full list is opt-in. */
const COLLAPSED_COUNT = 12;

export function CastList({ showId }: { showId: number }) {
  const { data, isError, error, refetch } = useShowCast(showId);
  const [expanded, setExpanded] = useState(false);

  // A failed request must not look like the (very common) empty case.
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  // 27% of shows have zero cast. That is the normal case, not an error state —
  // render nothing at all rather than an empty header.
  if (!data || data.length === 0) return null;

  // The API returns billing order (`sort_order`). Never re-sort here.
  const visible = expanded ? data : data.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-labelledby="cast-heading">
      <h2 id="cast-heading" className="mb-3 text-lg font-semibold">
        Cast <span className="font-normal text-muted-foreground">({data.length})</span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((entry, i) => (
          // Credit rows carry no upstream id and upstream does emit repeat
          // person/character pairs, so the index is part of the key.
          <li key={`${entry.person.id}-${entry.character.id}-${i}`}>
            <PersonChip
              person={entry.person}
              detail={entry.voice ? `${entry.character.name} (voice)` : entry.character.name}
            />
          </li>
        ))}
      </ul>
      {data.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 rounded text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : `Show all ${data.length}`}
        </button>
      )}
    </section>
  );
}
