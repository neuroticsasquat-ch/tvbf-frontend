import { useState } from "react";
import { Trash2 } from "lucide-react";

import { useRemoveFromHistory } from "@/api/me";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";

/** The one control that erases a show's watch history (NEU-1193).
 *
 * It absorbs what `LibraryWatchedList`'s row held inline — the trash button,
 * the confirm dialog and `useRemoveFromHistory` — on `MyShowsButton`'s
 * precedent: a control that owns its own mutation is what lets a surface thread
 * a flat opt-in rather than a per-row callback, and it is what makes the grid
 * card's drawing a second *variant* rather than a second implementation.
 *
 * **Two variants, and the position is what says what is possible** (NEU-1187
 * §3.1). `labelled` is the row's action-row chip, unchanged from where it has
 * always been; `compact` is icon-only and reuses `MyShowsButton`'s compact
 * shell, in the poster's bottom-right corner. That corner is the remove-only
 * position, which this act always is — there is no "add watch history" — and it
 * is the placement NEU-1188 declined to invent, handing the card drawing here
 * rather than making it a fifth treatment with no rule behind it.
 *
 * **The glyph stays `Trash2` in both.** It is what this act has always looked
 * like here, and it is deliberately not `BookMinus`: bottom-right is a shared
 * corner, where `MyShowsButton` means "stop tracking" and this means "delete
 * what I watched". `MyShowsButton`'s own docstring rejects `CircleMinus`
 * precisely because on a card carrying a watch-progress bar it could be read as
 * *this* control — so the two must not converge on one picture.
 *
 * **The accessible name carries the show's name** in both variants, matching
 * `MyShowsButton` and `DismissRecommendationButton`: this is the destructive,
 * irreversible one, and the compact variant has no visible text at all.
 *
 * **The confirm dialog stays**, where the recommendations chip has none. The
 * loss that one guards is bounded — the suggestion goes, the show does not —
 * and this deletes every episode the person ever marked, which nothing restores.
 *
 * **Both variants stay disabled while the mutation is in flight** (NEU-1187
 * §3.2), which the row's inline version was not: the dialog closes on confirm,
 * so a live button could be reopened and fired again mid-`DELETE`.
 *
 * `onRemoved` reports **that a removal landed**, so the surface can move focus
 * once the row or card unmounts (`useFocusAfterRemoval`). It fires from
 * `mutate`'s `onSuccess`, so a failed removal moves nobody's focus — the row
 * comes back and `useRemoveFromHistory` raises its own toast. The subtlety is
 * `MyShowsButton`'s: that mutation is optimistic and drops the entry in
 * `onMutate`, so the surface has already re-rendered without this show by the
 * time the request settles, and what keeps the freed slot's index knowable is
 * that the callback passed to `mutate` closes over the surface's list as of the
 * click.
 */
export function RemoveWatchHistoryButton({
  showId,
  showName,
  variant = "labelled",
  onRemoved,
}: {
  showId: number;
  /** The show's name, for the accessible name of either variant. */
  showName: string;
  variant?: "labelled" | "compact";
  /** Fires once a removal has landed, so a surface can manage focus. */
  onRemoved?: (showId: number) => void;
}) {
  const remove = useRemoveFromHistory();
  const [confirming, setConfirming] = useState(false);

  const label = `Remove ${showName} watch history`;

  // The handle `useFocusAfterRemoval` queries for, deliberately explicit for
  // the reason `data-dismiss-recommendation` and `data-remove-from-my-shows`
  // are: the surface reaches into the rendered card by attribute rather than
  // through three levels of ref forwarding (NEU-1193, and not in its scope to
  // revisit).
  const handle = { "data-remove-watch-history": "" };

  const dialog = confirming && (
    <ConfirmDialog
      title="Remove from history"
      description={`Remove all watch history for ${showName}? This cannot be undone.`}
      confirmLabel="Confirm"
      destructive
      pending={remove.isPending}
      onConfirm={() => {
        remove.mutate({ showId }, { onSuccess: () => onRemoved?.(showId) });
        setConfirming(false);
      }}
      onClose={() => setConfirming(false)}
    />
  );

  if (variant === "compact") {
    return (
      <>
        <button
          type="button"
          {...handle}
          onClick={() => setConfirming(true)}
          disabled={remove.isPending}
          aria-label={label}
          title="Remove watch history"
          className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        {...handle}
        onClick={() => setConfirming(true)}
        disabled={remove.isPending}
        aria-label={label}
        className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Watch History
      </Button>
      {dialog}
    </>
  );
}
