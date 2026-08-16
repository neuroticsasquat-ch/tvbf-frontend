import type { ShowSummary } from "@/api/types";
import { ShowCard, type PremiereDisplay } from "./ShowCard";

/** A grid of poster cards.
 *
 * `shows` widens to anything that is a `ShowSummary` carrying an optional
 * `reason`, so a `Recommendation[]` passes through unchanged and its prose
 * reaches the card (NEU-1114) — and an optional `in_my_shows`, so a
 * `TrendingShow[]` does the same and its mark reaches the card (NEU-1057).
 * Both are optional, so every existing caller is unaffected: a payload without
 * the field renders a card without the mark.
 *
 * `premiereDisplay` is passed to every card and defaults to the year, so the
 * choice is made once per grid rather than per row — a list where some cards
 * carry a year and others a full date would read as inconsistent data rather
 * than as a deliberate difference between surfaces (NEU-1060).
 */
export function ShowGrid({
  shows,
  premiereDisplay,
}: {
  shows: (ShowSummary & { reason?: string; in_my_shows?: boolean })[];
  premiereDisplay?: PremiereDisplay;
}) {
  if (shows.length === 0) {
    return <p className="py-16 text-center text-muted-foreground">No shows match your filters.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
      {shows.map((s) => (
        <ShowCard
          key={s.id}
          show={s}
          reason={s.reason}
          inMyShows={s.in_my_shows}
          premiereDisplay={premiereDisplay}
        />
      ))}
    </div>
  );
}
