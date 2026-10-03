import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { useAddShow, useRemoveShow } from "@/api/me";
import { RemoveFromMyShowsDialog } from "@/components/RemoveFromMyShowsDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** The one add/remove My Shows affordance carried by a card or a row.
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
 * viewer context, while a friend Active row reads the caller's library only. A
 * prop that tried to cover both would be a second copy of that decision.
 *
 * **Adding and removing a show from My Shows is a labelled action-row control,
 * never a poster overlay, and removing always asks first (NEU-1511).** The
 * viewer's own My Shows · Active offers no removal at all: every entry there is
 * in My Shows by definition, so the control could only remove, and a remove-only
 * control over a poster is what got tapped by mistake. That tab's removal path
 * is the show page.
 *
 * Adding stays one activation: a stray add costs one un-toggle and loses
 * nothing. A removal opens `RemoveFromMyShowsDialog`, and the optimistic
 * override is not set until the viewer confirms, so a cancel changes nothing on
 * screen. The button stays disabled while the `DELETE` is in flight, which is
 * also what stops the dialog being reopened and fired twice (NEU-1193's reason,
 * in `RemoveWatchHistoryButton`). Every surface rendering this keeps its row or
 * card mounted after a removal — a Watched row is history-based, a friend's row
 * is theirs, a search result stays put — so `ConfirmDialog` handing focus back
 * to this button is the whole of the focus story.
 *
 * **The accessible name carries the show's name**, which is why `showName` is
 * required rather than optional. `DismissRecommendationButton` already does this
 * because a grid of identical labels is unnavigable, and this component renders
 * on that very grid, where twelve cards otherwise give twelve identical "Add to
 * My Shows". The *visible* text stays "My Shows".
 */
export function MyShowsButton({
  showId,
  showName,
  inMyShows,
}: {
  showId: number;
  /** The show's name, for the accessible name and the confirmation. */
  showName: string;
  inMyShows: boolean;
}) {
  const add = useAddShow();
  const remove = useRemoveShow();

  const [override, setOverride] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
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
    add.mutate({ showId, showName }, { onError: () => setOverride(false) });
  }
  function onRemove() {
    setConfirming(false);
    setOverride(false);
    remove.mutate(showId, { onError: () => setOverride(true) });
  }

  const label = tracked ? `Remove ${showName} from My Shows` : `Add ${showName} to My Shows`;

  // One fragment around both states, so the button keeps its DOM node when a
  // confirmed removal flips it to "add" — that is what lets `ConfirmDialog`
  // hand focus back to it as it closes, rather than to `<body>`.
  return (
    <>
      {tracked ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConfirming(true)}
          disabled={remove.isPending}
          aria-label={label}
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
          aria-label={label}
          className="h-7 px-2 gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          My Shows
        </Button>
      )}
      {confirming && (
        <RemoveFromMyShowsDialog
          showName={showName}
          pending={remove.isPending}
          onConfirm={onRemove}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
