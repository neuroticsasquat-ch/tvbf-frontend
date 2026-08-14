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
