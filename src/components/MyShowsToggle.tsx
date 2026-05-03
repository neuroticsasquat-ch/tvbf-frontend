import { Library } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useAddShow, useMyShows, useRemoveShow } from "@/api/me";

export function MyShowsToggle({ showId }: { showId: number }) {
  const { user } = useAuth();
  const { data, isPending } = useMyShows();
  const add = useAddShow();
  const remove = useRemoveShow();

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
    if (tracked) remove.mutate(showId);
    else add.mutate(showId);
  }

  return (
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
  );
}
