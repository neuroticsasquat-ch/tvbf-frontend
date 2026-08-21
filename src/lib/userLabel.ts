/** Naming a person inside a sentence (NEU-1169 §4.3).
 *
 * `UserIdentity` is the *drawn* pairing — a display name over a handle, on a
 * row or a page header. This is the same pairing where the surface is building
 * prose or an accessible name instead: a confirmation dialog's description, a
 * switch's `aria-label`, a report dialog's title. One function rather than six
 * copies of the template literal, for the reason the component exists.
 *
 * **Only consequential copy takes it.** Possessive prose keeps the display name
 * alone — `OwnerFacts`'s `ownerName` and `rating.ts`'s `ratingLabel` continue to
 * produce `Jeanne's rating: 4.0 out of 5` and `Jeanne is caught up`, because
 * `@jeanne_briggs's rating` reads badly and disambiguates nothing: you are
 * already inside one named person's context, having opened their library
 * deliberately (D8).
 */
export function nameWithHandle(user: { display_name: string; handle: string }): string {
  return `${user.display_name} (@${user.handle})`;
}
