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
        className="rounded border border-border px-3 py-1 text-sm text-muted-foreground opacity-70"
      >
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
      className={`rounded border px-3 py-1 text-sm ${
        tracked
          ? "border-border bg-background text-foreground"
          : "border-foreground bg-foreground text-background"
      }`}
    >
      {tracked ? "Remove from My Shows" : "Add to My Shows"}
    </button>
  );
}
