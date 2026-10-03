import { useState } from "react";
import { Library } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useAddShow, useMyShows, useRemoveShow } from "@/api/me";
import { RemoveFromMyShowsDialog } from "@/components/RemoveFromMyShowsDialog";

/** The show page's add/remove My Shows control — a page-level primary CTA,
 * deliberately not converged onto `MyShowsButton` (NEU-1187 D6): `ShowDetail`
 * carries no `in_my_shows` to feed that component's takes-the-answer contract,
 * so this reads the viewer's library itself and keeps an explicit loading state.
 *
 * **It is the only removal path from the viewer's own My Shows · Active**
 * (NEU-1511). That tab carries no removal control, because a remove-only chip
 * over the poster is what got tapped by mistake. So removing here **asks first**
 * through `RemoveFromMyShowsDialog`, as every removal from My Shows does, and
 * adding stays one activation — a stray add costs one un-toggle and loses
 * nothing. */
export function MyShowsToggle({ showId, showName }: { showId: number; showName: string }) {
  const { user } = useAuth();
  const { data, isPending } = useMyShows();
  const add = useAddShow();
  const remove = useRemoveShow();
  const [confirming, setConfirming] = useState(false);

  if (!user) return null;

  if (isPending || !data) {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1 text-sm text-muted-foreground opacity-70"
      >
        <Library className="h-4 w-4" aria-hidden />
        Loading…
      </button>
    );
  }

  const tracked = !!data.find((e) => e.show.id === showId);

  function onClick() {
    if (tracked) setConfirming(true);
    else add.mutate({ showId, showName });
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded border px-3 py-1 text-sm ${
          tracked
            ? "border-border bg-background text-foreground"
            : "border-foreground bg-foreground text-background"
        }`}
      >
        <Library className="h-4 w-4" aria-hidden />
        {tracked ? "Remove from My Shows" : "Add to My Shows"}
      </button>
      {confirming && (
        <RemoveFromMyShowsDialog
          showName={showName}
          pending={remove.isPending}
          onConfirm={() => {
            setConfirming(false);
            remove.mutate(showId);
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
