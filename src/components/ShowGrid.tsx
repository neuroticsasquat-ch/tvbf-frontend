import type { ShowSummary } from "@/api/types";
import { ShowCard, type PremiereDisplay } from "./ShowCard";

/** A grid of poster cards.
 *
 * `shows` widens to anything that is a `ShowSummary` carrying an optional
 * `in_my_shows`, so a `TrendingShow[]` / `AnticipatedShow[]` passes through
 * unchanged and its mark reaches the card (NEU-1057). It is optional, so every
 * existing caller is unaffected: a payload without the field renders a card
 * without the mark.
 *
 * `premiereDisplay` is passed to every card and defaults to the year, so the
 * choice is made once per grid rather than per row — a list where some cards
 * carry a year and others a full date would read as inconsistent data rather
 * than as a deliberate difference between surfaces (NEU-1060).
 *
 * `addable` is the same shape one prop further along (NEU-1176): the grid
 * threads a surface's opt-in card control to every card it renders, so the
 * decision is the surface's and the default — no control at all — is what every
 * other grid keeps without saying anything.
 */
export function ShowGrid({
  shows,
  premiereDisplay,
  addable,
}: {
  shows: (ShowSummary & { in_my_shows?: boolean })[];
  premiereDisplay?: PremiereDisplay;
  addable?: boolean;
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
          inMyShows={s.in_my_shows}
          premiereDisplay={premiereDisplay}
          addable={addable}
        />
      ))}
    </div>
  );
}
