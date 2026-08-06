import { useEpisodeCrew } from "@/api/shows";
import { ErrorState } from "@/components/ErrorState";
import { PersonChip } from "@/components/PersonChip";

/** Crew for one episode — director, writer, story, teleplay.
 *
 * A flat list in the API's order, deliberately not grouped by role the way
 * `CrewList` groups show crew. Two reasons. The order *is* the episode's own
 * credit sequence from upstream, and getting that sequence right is the whole
 * reason episode credits are fetched per season at all (ADR-0003) — grouping
 * would reorder across roles and throw it away. And the scale is different:
 * `CrewList` carries role groups and a "Show all" collapse because show crew
 * reaches 533 entries, where an episode carries a handful drawn from a
 * four-name vocabulary.
 *
 * 22.5% of episodes have no crew at all, so rendering nothing — no header, no
 * placeholder — is a common outcome rather than an edge case.
 */
export function EpisodeCrew({ episodeId }: { episodeId: number }) {
  const { data, isError, error, refetch } = useEpisodeCrew(episodeId);

  // A failed request must not look like the (common) empty case.
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const entries = data ?? [];
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="episode-crew-heading">
      <h2 id="episode-crew-heading" className="mb-3 text-lg font-semibold">
        Crew <span className="font-normal text-muted-foreground">({entries.length})</span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry, i) => (
          // Credit rows carry no upstream id, and one person holds more than one
          // crew role on 36 of 1,043 sampled episodes, so the index is part of
          // the key.
          <li key={`${entry.person.id}-${entry.role}-${i}`}>
            <PersonChip person={entry.person} detail={entry.role} />
          </li>
        ))}
      </ul>
    </section>
  );
}
