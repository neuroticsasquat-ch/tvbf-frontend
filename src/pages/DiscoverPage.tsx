import { RecommendedForYou } from "@/components/discover/RecommendedForYou";

/** The Discover page.
 *
 * Its sections are additive and each renders nothing when it has no rows, so a
 * Discover page with one section today and three later is the same page —
 * "Recommended for you" is the first (NEU-1114), and TMDB Discovery's trending
 * / most anticipated surfaces share this page rather than adding nav items of
 * their own.
 */
export function DiscoverPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Discover</h1>
      <RecommendedForYou />
    </section>
  );
}
