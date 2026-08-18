import { useEffect, useRef } from "react";

import { useRecommendations } from "@/api/me";
import { Anticipated } from "@/components/discover/Anticipated";
import { RecommendedForYou } from "@/components/discover/RecommendedForYou";
import { Trending } from "@/components/discover/Trending";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedString } from "@/hooks/usePersistedString";

/** The tabs holding Discover's browsing surfaces. "My Recommendations" leads
 * because it is the one surface addressed to this user; Trending is a claim
 * about right now, and Most Anticipated is the same catalog seen forwards. A
 * further surface is one entry here and one `TabsContent`. */
const DISCOVER_TABS = ["my-recommendations", "trending", "most-anticipated"] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number];
const DEFAULT_TAB: DiscoverTab = "my-recommendations";
/** Where a user with no recommendations lands, and where a stored
 * "my-recommendations" defers to for as long as there is nothing behind it. */
const FALLBACK_TAB: DiscoverTab = "trending";

/** `usePersistedString` deliberately returns whatever is in localStorage
 * without validating it, so the allowed-tab check belongs here — a persisted
 * value that outlives the tab it names falls back to the default rather than
 * selecting a tab that no longer exists. */
function isDiscoverTab(value: string): value is DiscoverTab {
  return (DISCOVER_TABS as readonly string[]).includes(value);
}

/** The Discover page.
 *
 * All three surfaces are tabs, and "My Recommendations" (NEU-1114) is the
 * first and the default: it is the one addressed to this user, so it is what
 * the page should open on for anybody who has it.
 *
 * **The tab is absent entirely for a user who has nothing in it**, rather than
 * present-and-disabled the way ShowDetailPage's cast and crew tabs are. The
 * cases behind an empty list are a set that has never been generated, a user
 * below the generation floor, a failed Sunday run and a failed request, and
 * the rule for all four is the same one the section had: show nothing at all,
 * because an empty state explaining an absent feature costs a real moment of
 * "why is this broken?" while advertising machinery nobody asked about
 * (project spec §11). A disabled tab is that empty state with a smaller
 * footprint. Cast and crew differ because a show having no crew is a fact
 * about the show worth reporting; a user having no recommendations is not a
 * fact about the catalog.
 *
 * The tab does stay up while the query is in flight, so it does not appear
 * and then vanish under the reader on the common path.
 *
 * Tab selection persists across visits, because a user who prefers one of them
 * prefers it every time. Only an *unrecognised* stored value is healed —
 * deferring to Trending because the recommendations are not there is a display
 * decision for this visit, and writing it back would spend the user's stored
 * preference on one bad Sunday.
 *
 * **Once the tab has been shown in this mount it stays shown** (NEU-1176).
 * A recommendation card can now be acted on from the grid, so adding the last
 * remaining suggestion would otherwise make the tab vanish under the user
 * mid-interaction and drop them on Trending — their own action reading as an
 * unrequested navigation. The tab is still absent on the *next* visit, so §11's
 * "never advertise absent machinery" rule is untouched for every user it was
 * written for: a user who has just used their recommendations up is not a user
 * who has never had any.
 */
export function DiscoverPage() {
  const [stored, setStored] = usePersistedString("discover-tab", DEFAULT_TAB);
  const parsed = isDiscoverTab(stored) ? stored : DEFAULT_TAB;
  // Fetched here to decide whether the tab exists at all. `RecommendedForYou`
  // runs the same query and React Query dedupes on the key, so this costs no
  // extra request.
  const recommendationsQuery = useRecommendations();
  const hasRecommendations = (recommendationsQuery.data?.recommendations.length ?? 0) > 0;
  const recommendationsPending = recommendationsQuery.isPending;
  // A ref rather than state: the latch never causes a render of its own — the
  // render that empties the list is the one that reads it.
  const hadRecommendations = useRef(false);
  if (hasRecommendations) hadRecommendations.current = true;
  const showRecommendations =
    hasRecommendations || recommendationsPending || hadRecommendations.current;
  const tab = parsed === "my-recommendations" && !showRecommendations ? FALLBACK_TAB : parsed;

  // Heal the store as well as the render. `usePersistedString` writes back
  // whatever it is holding, so a value naming no tab would otherwise survive —
  // and silently select that tab the day a later ticket adds one by that name.
  useEffect(() => {
    if (stored !== parsed) setStored(parsed);
  }, [stored, parsed, setStored]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Discover</h1>
      <Tabs value={tab} onValueChange={setStored}>
        <TabsList>
          {showRecommendations && (
            <TabsTrigger value="my-recommendations">My Recommendations</TabsTrigger>
          )}
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="most-anticipated">Most Anticipated</TabsTrigger>
        </TabsList>
        <TabsContent value="my-recommendations">
          <RecommendedForYou />
        </TabsContent>
        <TabsContent value="trending">
          <Trending />
        </TabsContent>
        <TabsContent value="most-anticipated">
          <Anticipated />
        </TabsContent>
      </Tabs>
    </section>
  );
}
