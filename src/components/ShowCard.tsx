import type { ShowSummary } from "@/api/types";
import { DismissRecommendationButton } from "@/components/DismissRecommendationButton";
import { MyShowsButton } from "@/components/MyShowsButton";
import { RatingBadge } from "@/components/RatingBadge";
import { ShowPoster } from "@/components/ShowPoster";
import { tenPointToFiveStar } from "@/lib/rating";

const PREMIERE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** How much of the premiere date the card's date line shows.
 *
 * `"year"` is what every catalog surface has always shown, and the only thing
 * a mixed list of decades can usefully carry. `"date"` is Most Anticipated's
 * (NEU-1060): every entry there premieres within the coming year, so the year
 * alone distinguishes almost nothing and the date is the whole point of the
 * surface.
 */
export type PremiereDisplay = "year" | "date";

function premiereLabel(dateStr: string | null, display: PremiereDisplay): string {
  // An undated show reads "—" beside dated ones on a catalog list and "TBA"
  // on a list of things being waited for, where a dash would read as a
  // rendering failure. `/anticipated` never sends one (contract §5), so this
  // is the card declining to trust that rather than a case it expects.
  if (!dateStr) return display === "date" ? "TBA" : "—";
  if (display === "year") return dateStr.slice(0, 4);
  const [y, m, d] = dateStr.split("-").map(Number);
  // Built from the parts rather than `new Date(iso)`, which reads a bare
  // `YYYY-MM-DD` as UTC and renders the day before for a viewer west of it.
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "TBA";
  return PREMIERE_FMT.format(new Date(y, m - 1, d));
}

/** A poster card for one show.
 *
 * There is deliberately **no body-text line**. Recommendations used to carry a
 * model-authored `reason` here (NEU-1114), rendered as one truncated 10px line
 * — which is not room for a sentence, so the server stopped serving it. Do not
 * reintroduce a prose row on this card without giving it somewhere to fit.
 *
 * `inMyShows` marks a show the viewer already tracks (NEU-1057). It is a mark
 * and never a filter — the surfaces that carry it are claims about the world,
 * and seeing your own show in one is a feature. The mark itself is
 * `InMyShowsBadge`, shared with the card grids and the friend list rows so that
 * one claim has one picture — drawn by `ShowPoster`, which is where its corner
 * is decided (NEU-1183 §3.4). This card states no position for it, and neither
 * should any other surface.
 *
 * `premiereDisplay` chooses how much of the premiere date the date line
 * carries; it defaults to the year every existing caller has always rendered.
 *
 * `addable` is the containment seam for surface-specific controls (NEU-1176).
 * This card is shared by trending, most anticipated, similar shows, search and
 * browse, so an affordance that belongs to *one* surface arrives as an opt-in
 * prop threaded through `ShowGrid` rather than as a default every grid then has
 * to opt out of. Only `RecommendedForYou` passes it today.
 *
 * `dismissible` is the same seam one control further along (NEU-1179), and it
 * is independent of `addable`: the one surface that passes either passes both,
 * and every other grid passes neither. `onDismissed` reports a landed dismissal
 * back to that surface so it can move focus; it is one function reference
 * shared by every card, and the card hands its own id back.
 *
 * **The dismiss chip overlays the poster where the add button sits below it.**
 * Measured: at a 375px viewport `AppShell`'s `max-w-6xl px-4` and the grid's
 * `grid-cols-3 gap-2` leave a card ~109px wide, so ~97px inside the action
 * row's `px-1.5`. `MyShowsButton` is ~78px, and a second control even at an
 * icon-only `h-7 w-7` needs 78 + 4 + 28 = 110px. It does not fit, and wrapping
 * or stacking would make recommendation cards taller than every other card in
 * a shared grid. The overlay costs no row width and changes card height on no
 * surface — that argument is unchanged.
 *
 * **Which corner it overlays is no longer this card's to decide.** It used to
 * sit top-right, and the card's own docstring justified that as safe by
 * coincidence: `my_rating` is null on the recommendations contract, and a show
 * the viewer tracks or has rated is suppressed before it can be recommended at
 * all — so both corners happened to be free. `ShowPoster` ends the coincidence
 * by rule (NEU-1183 §3.4, §5.3): facts on top, controls on the bottom, so the
 * chip is passed as `control` and lands bottom-right. Making a rating and a
 * control mutually exclusive in the type was rejected — it encodes the
 * constraint as a prohibition, and the prohibited thing (a recommendations grid
 * that eventually shows the viewer's rating) is reasonable.
 *
 * The button is a **sibling of the poster's `Link`, never a descendant**: a
 * `<button>` inside an `<a>` is invalid content nesting and a real focus-order
 * problem. `ShowPoster` is what makes that structural rather than remembered
 * here — it renders the control in an overlay layer beside its link, so no
 * `preventDefault` is needed for a control that must not navigate. The border,
 * rounding and hover transition belong to the outer wrapper — they are the
 * card's, not the link's — while `group` lives on the poster's link, which is
 * the one this card's title sits inside, so hovering either underlines it and
 * hovering an overlay control does not.
 */
export function ShowCard({
  show,
  inMyShows,
  premiereDisplay = "year",
  addable,
  dismissible,
  onDismissed,
}: {
  show: ShowSummary;
  inMyShows?: boolean;
  premiereDisplay?: PremiereDisplay;
  addable?: boolean;
  dismissible?: boolean;
  onDismissed?: (showId: number) => void;
}) {
  const aggregate = tenPointToFiveStar(show.rating_average);
  return (
    <div className="relative overflow-hidden rounded border border-border bg-background transition hover:border-foreground">
      <ShowPoster
        to={`/shows/${show.id}`}
        src={show.image_medium}
        linkLabel={show.name}
        size="card"
        inMyShows={inMyShows}
        ownRating={show.my_rating}
        control={
          dismissible ? (
            <DismissRecommendationButton
              showId={show.id}
              showName={show.name}
              onDismissed={onDismissed}
            />
          ) : undefined
        }
      >
        <div className="p-1.5">
          <div className="flex items-baseline gap-1">
            <h3 className="truncate text-xs font-medium leading-tight group-hover:underline">
              {show.name}
            </h3>
            {aggregate != null && (
              <RatingBadge
                kind="aggregate"
                crowdName="TMDB"
                value={aggregate}
                className="shrink-0 text-[10px] py-0 px-1"
              />
            )}
          </div>
          {show.matched_aka && (
            <p className="truncate text-[10px] text-muted-foreground leading-tight italic">
              {show.matched_aka}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground leading-tight">
            {premiereLabel(show.premiered, premiereDisplay)}
          </p>
        </div>
      </ShowPoster>
      {addable && (
        // The button reads the card's own `inMyShows`, so it can never
        // contradict the badge above it. On the one surface that passes
        // `addable` that value is false by construction — the server
        // suppresses any show the viewer already has a record for, so a
        // tracked show never renders there — but taking the answer from the
        // card rather than hard-coding it is what keeps the next `addable`
        // surface from showing a "tracked" badge beside an "Add" button.
        //
        // The button's own optimistic override supplies the "✓ My Shows" beat
        // between the click and the card disappearing, which is the only
        // feedback there is: the card vanishing is the confirmation, so there
        // is no success state, and a failed add reverts and leaves the card in
        // place.
        <div className="px-1.5 pb-1.5">
          <MyShowsButton showId={show.id} showName={show.name} inMyShows={inMyShows ?? false} />
        </div>
      )}
    </div>
  );
}
