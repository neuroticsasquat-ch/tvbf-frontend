import { useState } from "react";
import { BookMinus, Check, Plus } from "lucide-react";

import { useAddShow, useRemoveShow } from "@/api/me";
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
 * **The rule (NEU-1187 §3.1):**
 *
 * > The control **overlays the poster where it can only remove**; it sits in
 * > the card or row's **action row wherever adding is possible.**
 *
 * That is what `variant` selects between, and the two positions mean different
 * things, which is what makes them two. `labelled` is the action-row chip —
 * Watched rows, friend libraries, the recommendations grid, the browse grids.
 * `compact` is icon-only and reuses `DismissRecommendationButton`'s shell
 * verbatim, because it occupies the same corner of the same poster; only the
 * glyph and the label differ. Exactly one surface passes it today: the viewer's
 * own My Shows · Active, in both views, where every row is in My Shows by
 * definition so the labelled chip could only ever say one thing.
 *
 * This paragraph replaces one recording `LibraryActiveList`'s self mode as a
 * deliberate fourth copy, on the grounds that "what the click updates is the
 * *row*, not the button". That reason was stale: `useRemoveShow` filters the
 * show out of every `["my-shows"]` query in `onMutate` and restores its
 * snapshot in `onError` (`api/me.ts`), and the Active tab feeds straight off
 * `useMyShows()`, so the row already unmounts optimistically and already
 * reverts — from the mutation, not from either component. The copy's local
 * `removed` state was a second copy of that, and is gone (NEU-1187 §2.2).
 *
 * **`compact` renders both states even though its one surface can only ever
 * reach the remove state.** Hard-coding it would put a second decision inside a
 * component whose whole contract is that it takes the answer, and `ShowCard`'s
 * `addable` comment already argues this: taking the answer from the caller is
 * what keeps the next surface from showing a "tracked" badge beside an "Add"
 * button.
 *
 * **The compact glyph is `BookMinus`** (NEU-1187 §D4). Bottom-right is a shared
 * corner: on a recommendations card it means "never show me this again" (`X`),
 * here it means "stop tracking". Emerald `Check` is out — `InMyShowsBadge`'s
 * docstring records that a green ✓ means *watched* everywhere else in this app,
 * a different fact about a show from *tracked*. `CircleMinus` says nothing
 * about what it removes *from*, and these cards carry a watch-progress bar, so
 * it could read as removing watch history — a different, destructive act.
 * `BookMinus` sits in the same family as the `Library` glyph the mark and
 * `MyShowsToggle` already use; `Library` itself was rejected because it would
 * appear as a *fact* top-left and a *control* bottom-right.
 *
 * **Both variants' accessible names carry the show's name** (§D3), which is why
 * `showName` is required rather than optional. `DismissRecommendationButton`
 * already does this because a grid of identical labels is unnavigable, and this
 * component renders on that very grid, where twelve cards otherwise give twelve
 * identical "Add to My Shows". The compact chip has no visible text at all,
 * which makes the name load-bearing rather than nice. The labelled variant's
 * *visible* text stays "My Shows".
 *
 * `onRemoved` reports **that a removal has been applied**, so the surface can
 * move focus after the card unmounts (`LibraryActiveList`, NEU-1187 §3.5) — the
 * same shape `DismissRecommendationButton.onDismissed` has, and passed the same
 * way: one function reference for every card, with the card handing its own id
 * back. Only a removal that **landed** is reported, so a failed one moves nobody's
 * focus. The subtlety worth knowing: `useRemoveShow` is optimistic and drops the
 * row in `onMutate`, so by the time this fires the surface has re-rendered
 * without the show — what makes the freed slot's index still knowable is that
 * `mutate`'s callback closes over the surface's list *as of the click*. Anything
 * that re-resolved the callback after the mutation settled would hand the
 * surface an id its list no longer holds.
 */
export function MyShowsButton({
  showId,
  showName,
  inMyShows,
  variant = "labelled",
  onRemoved,
}: {
  showId: number;
  /** The show's name, for the accessible name of either variant. */
  showName: string;
  inMyShows: boolean;
  variant?: "labelled" | "compact";
  /** Fires once a removal has landed, so a surface can manage focus. See the
   * note above on why the freed slot's index survives an optimistic removal. */
  onRemoved?: (showId: number) => void;
}) {
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
    // `onSuccess`, so only a removal that *landed* is reported — and the
    // callback this closure carries is the one from the render the click
    // happened in. That is load-bearing rather than incidental: `useRemoveShow`
    // is optimistic and drops the row in `onMutate`, so the surface has already
    // re-rendered without this show by the time the request settles, and a
    // callback resolved *then* would be looking for it in a list it has left.
    // Capturing it here is what keeps the index of the freed slot knowable.
    remove.mutate(showId, {
      onError: () => setOverride(true),
      onSuccess: () => onRemoved?.(showId),
    });
  }

  const label = tracked ? `Remove ${showName} from My Shows` : `Add ${showName} to My Shows`;

  if (variant === "compact") {
    return (
      <button
        type="button"
        // `LibraryActiveList`'s handle for the post-removal focus move
        // (NEU-1187 §3.5), deliberately explicit for the reason
        // `data-dismiss-recommendation` is: the surface reaches into the
        // rendered card by attribute rather than through three levels of ref
        // forwarding across components shared by surfaces that need none of it.
        data-remove-from-my-shows=""
        onClick={tracked ? onRemove : onAdd}
        disabled={tracked ? remove.isPending : add.isPending}
        aria-label={label}
        title={tracked ? "Remove from My Shows" : "Add to My Shows"}
        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur">
          {tracked ? (
            <BookMinus className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
      </button>
    );
  }

  return tracked ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onRemove}
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
  );
}
