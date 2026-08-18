import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { useAddShow, useRemoveShow } from "@/api/me";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** The small "My Shows" add/remove toggle carried by a list row or a card.
 *
 * It absorbs three things that were previously duplicated verbatim in
 * `LibraryActiveList`'s friend-mode `ActionButton` and
 * `LibraryWatchedList`'s `WatchedRow` (NEU-1176): the two mutations and their
 * click handlers, the optimistic `override` / `lastUpstream` reconciliation,
 * and both visual states. The behavioural half is the part that can actually
 * be *wrong* — extracting only the markup would have left two copies of the
 * reconciliation, which is the mistake `InMyShowsBadge` already paid for once
 * (NEU-1057: three marks, two of which disagreed).
 *
 * **It takes the answer, not the sources.** Deriving `inMyShows` stays at each
 * call site, because the call sites disagree about where truth lives:
 * `WatchedRow` picks between `entry.in_my_shows` and the caller's library on
 * viewer context, while `ActionButton` reads the caller's library only. A prop
 * that tried to cover both would be a second copy of that decision.
 *
 * **One call site deliberately keeps its own copy**: `LibraryActiveList`'s
 * *self* mode, where clicking Remove optimistically hides the whole row and
 * reverts on error. What it updates is the row, not the button, and routing a
 * row's lifecycle through this component's interface would put the revert path
 * — the one nobody exercises by hand — through two components instead of one.
 * That fourth visual copy is an exception on purpose, recorded here rather
 * than discovered.
 */
export function MyShowsButton({ showId, inMyShows }: { showId: number; inMyShows: boolean }) {
  const add = useAddShow();
  const remove = useRemoveShow();

  const [override, setOverride] = useState<boolean | null>(null);
  const [lastUpstream, setLastUpstream] = useState(inMyShows);
  // Upstream truth moving is what clears a stale override: without this the
  // local guess outlives the refetch that confirmed or contradicted it.
  if (lastUpstream !== inMyShows) {
    setLastUpstream(inMyShows);
    setOverride(null);
  }
  const tracked = override ?? inMyShows;

  function onAdd() {
    setOverride(true);
    add.mutate(showId, { onError: () => setOverride(false) });
  }
  function onRemove() {
    setOverride(false);
    remove.mutate(showId, { onError: () => setOverride(true) });
  }

  return tracked ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onRemove}
      disabled={remove.isPending}
      aria-label="Remove from My Shows"
      className={cn(
        "h-7 px-2 gap-1 text-xs",
        "border-emerald-600 text-emerald-700 hover:bg-emerald-50",
        "dark:text-emerald-400 dark:hover:bg-emerald-950/40",
      )}
    >
      <Check className="h-3.5 w-3.5" aria-hidden />
      My Shows
    </Button>
  ) : (
    <Button
      type="button"
      size="sm"
      onClick={onAdd}
      disabled={add.isPending}
      aria-label="Add to My Shows"
      className="h-7 px-2 gap-1 text-xs"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
      My Shows
    </Button>
  );
}
