export const STAR_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export type StarValue = (typeof STAR_VALUES)[number];

/** A ten-point catalogue score as a five-star one, to one decimal place.
 *
 * Named for the conversion rather than for whoever supplies the score: it was
 * `tvmazeToFiveStar` until NEU-1147, by which time the value had been TMDB's
 * `vote_average` for some while and only the name still said otherwise.
 */
export const tenPointToFiveStar = (v: number | null | undefined): number | null =>
  v == null ? null : Math.round((v / 2) * 10) / 10;

export const formatStars = (v: number): string => v.toFixed(1);

/** Which kind of rating a number is — the vocabulary NEU-1182 §3.1 settled.
 *
 * Three kinds, because the app draws three: the viewer's own, one named
 * person's, and a crowd's. The kind is not a presentational choice, it is what
 * the number *is*, so every component that draws one takes it as a required
 * discriminator rather than as a free-text `title`. That prop is what let the
 * viewer's rating and TMDB's average share one pixel-identical chip.
 *
 * `ownerName` and `crowdName` are required on the kinds that have one, so a
 * rating cannot be attributed to nobody. `crowdName` is a departure from the
 * spec's §4.1 union, which typed `aggregate` with no fields: §4.4 then moves
 * `FriendRatingsList`'s friends-average onto this kind, and a fixed "TMDB
 * average" label would announce a friend group's score as TMDB's.
 */
export type RatingAttribution =
  { kind: "own" } | { kind: "aggregate"; crowdName: string } | { kind: "other"; ownerName: string };

const attributionPhrase = (attribution: RatingAttribution): string => {
  switch (attribution.kind) {
    case "own":
      return "Your rating";
    case "aggregate":
      return `${attribution.crowdName} average`;
    case "other":
      return `${attribution.ownerName}'s rating`;
  }
};

/** The one accessible name (and tooltip) a rating carries, in either form.
 *
 * Shared by the chip and the five-star display so the two are one vocabulary at
 * two densities rather than two components agreeing by review (§3.2).
 */
export const ratingLabel = (attribution: RatingAttribution, value: number): string =>
  `${attributionPhrase(attribution)}: ${formatStars(value)} out of 5`;

/** Whose facts a card or library row is holding — the viewer's own, or one
 * named person's.
 *
 * **A resolved answer, never the sources.** `MyShowCard` takes this rather than
 * a `viewerContext` plus a `callerLibrary`, so deriving it stays at the call
 * site — NEU-1176's `MyShowsButton` seam applied one component over
 * (NEU-1182 §3.3). It is required with no default, because a default of "yours"
 * is precisely what made the next shared surface silently wrong.
 *
 * It is the rating vocabulary minus `aggregate` rather than the spec §6.2's own
 * `{ kind: "you" } | { kind: "other"; name: string }`: a crowd cannot own a
 * library row, but a second union tagged `"you"` beside one tagged `"own"` is
 * the vocabulary drift this design exists to end, and reusing this one lets an
 * owner be handed straight to `RatingBadge` as its attribution.
 */
export type RatingOwner = Exclude<RatingAttribution, { kind: "aggregate" }>;
