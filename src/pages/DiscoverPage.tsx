import { useEffect } from "react";

import { Anticipated } from "@/components/discover/Anticipated";
import { RecommendedForYou } from "@/components/discover/RecommendedForYou";
import { Trending } from "@/components/discover/Trending";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedString } from "@/hooks/usePersistedString";

/** The tabs holding TMDB Discovery's browsing surfaces. Trending leads because
 * it is a claim about right now; Most Anticipated (NEU-1060) is the same
 * catalog seen forwards. A further surface is one entry here and one
 * `TabsContent`. */
const DISCOVER_TABS = ["trending", "most-anticipated"] as const;
type DiscoverTab = (typeof DISCOVER_TABS)[number];
const DEFAULT_TAB: DiscoverTab = "trending";

/** `usePersistedString` deliberately returns whatever is in localStorage
 * without validating it, so the allowed-tab check belongs here — a persisted
 * value that outlives the tab it names falls back to the default rather than
 * selecting a tab that no longer exists. */
function isDiscoverTab(value: string): value is DiscoverTab {
  return (DISCOVER_TABS as readonly string[]).includes(value);
}

/** The Discover page.
 *
 * Two kinds of thing share it. "Recommended for you" (NEU-1114) is a section:
 * it is per-user, it renders nothing when there is nothing to show, and a tab
 * that is empty for a user below the generation floor would be a nav entry
 * leading nowhere. TMDB Discovery's browsing surfaces are tabs — Trending
 * (NEU-1057) and Most Anticipated (NEU-1060) — because they are alternative
 * views of the whole catalog rather than additive sections, and they earn one
 * nav slot between them rather than one each.
 *
 * Tab selection persists across visits, because a user who prefers one of them
 * prefers it every time.
 */
export function DiscoverPage() {
  const [stored, setStored] = usePersistedString("discover-tab", DEFAULT_TAB);
  const tab = isDiscoverTab(stored) ? stored : DEFAULT_TAB;
  // Heal the store as well as the render. `usePersistedString` writes back
  // whatever it is holding, so a value naming no tab would otherwise survive —
  // and silently select that tab the day a later ticket adds one by that name.
  useEffect(() => {
    if (stored !== tab) setStored(tab);
  }, [stored, tab, setStored]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Discover</h1>
      <RecommendedForYou />
      <Tabs value={tab} onValueChange={setStored}>
        <TabsList>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="most-anticipated">Most Anticipated</TabsTrigger>
        </TabsList>
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
