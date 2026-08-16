/** The Discover page.
 *
 * Page shell only (NEU-1113): the route, the nav slot and the heading. Its
 * sections are additive and each renders nothing when it has no rows, so a
 * Discover page with one section today and three later is the same page — the
 * "Recommended for you" section lands in NEU-1114, and TMDB Discovery's
 * trending / most anticipated surfaces share this page rather than adding nav
 * items of their own.
 */
export function DiscoverPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Discover</h1>
    </section>
  );
}
