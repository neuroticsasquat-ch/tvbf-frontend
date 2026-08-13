/** How a season is labelled, in the one place that decides (NEU-1129).
 *
 * The specials season read "Season 0" everywhere, because five render sites
 * each built their own label out of the season *number* and ignored the `name`
 * the API has always carried. TMDB names that season "Specials" and the
 * migration brought it across — `catalog.season.name` holds it for 12,633 of
 * 12,638 season-0 rows in production.
 *
 * So the rule is **prefer the server-supplied name, fall back to the number** —
 * deliberately not `number === 0 ? "Specials" : ...`. The special case is
 * upstream's to state rather than ours to infer, which keeps the 5 unnamed
 * season-0 rows honest ("Season 0", not a label we invented) and gives a show
 * whose season 4 is named "The Final Season" that label for free.
 *
 * Note the number is *replaced*, not prefixed: a named season renders as its
 * name alone. TMDB names most seasons "Season N" anyway, so the common case is
 * byte-identical to what these sites rendered before.
 */
export function seasonLabel(season: { number: number; name?: string | null }): string {
  return season.name?.trim() || `Season ${season.number}`;
}
