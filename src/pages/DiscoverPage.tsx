import { useEffect } from "react";
import { ChevronDown } from "lucide-react";

import { useRecommendations } from "@/api/me";
import { Anticipated } from "@/components/discover/Anticipated";
import { PopularWithFriends } from "@/components/discover/PopularWithFriends";
import { RecommendedForYou } from "@/components/discover/RecommendedForYou";
import { Trending } from "@/components/discover/Trending";
import { FilterSheet } from "@/components/home/FilterSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLatched } from "@/hooks/useLatched";
import { usePersistedString } from "@/hooks/usePersistedString";

/** The tabs holding Discover's browsing surfaces. "My Recommendations" leads
 * because it is the one surface addressed to this user; Trending is a claim
 * about right now, Popular with Friends is the same claim about your own
 * people (NEU-1500), and Most Anticipated is the catalog seen forwards. A
 * further surface is one entry here and one `TabsContent`.
 *
 * Each entry carries its label because two views read this one list — the
 * tab row and, below `md`, the picker sheet (NEU-1503) — so they cannot
 * disagree about which tabs exist or what they are called. */
const DISCOVER_TABS = [
  { value: "my-recommendations", label: "My Recommendations" },
  { value: "trending", label: "Trending" },
  { value: "popular-with-friends", label: "Popular with Friends" },
  { value: "most-anticipated", label: "Most Anticipated" },
] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number]["value"];
const DEFAULT_TAB: DiscoverTab = "my-recommendations";
/** Where a user with no recommendations lands, and where a stored
 * "my-recommendations" defers to for as long as there is nothing behind it. */
const FALLBACK_TAB: DiscoverTab = "trending";

/** `usePersistedString` deliberately returns whatever is in localStorage
 * without validating it, so the allowed-tab check belongs here — a persisted
 * value that outlives the tab it names falls back to the default rather than
 * selecting a tab that no longer exists. */
function isDiscoverTab(value: string): value is DiscoverTab {
  return DISCOVER_TABS.some((t) => t.value === value);
}

/** The Discover page.
 *
 * Every surface is a tab, and "My Recommendations" (NEU-1114) is the
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
  // Latched here rather than inside the panel, because Radix unmounts an
  // inactive `TabsContent`: a panel-scoped latch is lost the moment the user
  // looks at Trending and comes back, which would leave this tab standing over
  // a pane rendering nothing. This page outlives every tab switch, so it is
  // what the panel reads through `everHadRows` below.
  const everHadRecommendations = useLatched(hasRecommendations);
  const showRecommendations =
    hasRecommendations || recommendationsPending || everHadRecommendations;
  const tab = parsed === "my-recommendations" && !showRecommendations ? FALLBACK_TAB : parsed;
  // The one filtered list both views render. Popular with Friends is always
  // present, unlike My Recommendations: its two empty states are the point —
  // they say something true about the viewer's friends rather than
  // advertising absent machinery.
  const tabs = DISCOVER_TABS.filter((t) => t.value !== "my-recommendations" || showRecommendations);
  const tabLabel = tabs.find((t) => t.value === tab)?.label ?? "";

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
        {/* Measured with the real trigger classes (`px-3 text-sm font-medium`):
          My Recommendations 186px, Trending 96px, Popular with Friends
          204px, Most Anticipated 168px — 664px together, against about 333px
          inside the gutter and list chrome at a 375px viewport. No stacked
          layout fits either: any row of three is 450–478px, and the best
          two-per-row pairing still needs about 364px on its second row. A
          sideways-scrolling row (NEU-1500) hid the fourth tab off-screen with
          nothing to say it was there, so below `md` the row gives way to a
          picker sheet (NEU-1503); from `md` (about 736px of content) the row
          fits. The hidden triggers still label the panels, which is valid —
          a hidden element can name another. */}
        <div className="md:hidden">
          <FilterSheet
            title="Discover"
            triggerLabel={
              <span className="inline-flex items-center gap-1">
                {tabLabel}
                <ChevronDown className="h-4 w-4" aria-hidden />
              </span>
            }
            ariaLabel={`Discover section: ${tabLabel}`}
            options={tabs.map((t) => ({ key: t.value, label: t.label }))}
            value={tab}
            onChange={setStored}
          />
        </div>
        <TabsList className="hidden md:inline-flex">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="my-recommendations">
          <RecommendedForYou everHadRows={everHadRecommendations} />
        </TabsContent>
        <TabsContent value="trending">
          <Trending />
        </TabsContent>
        <TabsContent value="popular-with-friends">
          <PopularWithFriends />
        </TabsContent>
        <TabsContent value="most-anticipated">
          <Anticipated />
        </TabsContent>
      </Tabs>
    </section>
  );
}
