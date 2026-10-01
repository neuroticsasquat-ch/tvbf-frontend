/** "12 episodes" for a credit that carries a count, nothing for one that
 * doesn't. Zero reads as missing data rather than as a fact worth printing, and
 * a negative count is not a thing the API can mean.
 *
 * Shared by the cast and crew lists and the person page's cards: what the
 * count *means* varies by route (NEU-1512 §4.1), but how it reads does not. */
export function episodeCountLabel(count: number | null | undefined): string | undefined {
  if (typeof count !== "number" || count < 1) return undefined;
  return `${count} ${count === 1 ? "episode" : "episodes"}`;
}
