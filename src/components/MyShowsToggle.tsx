import { useAuth } from "./AuthContext";
import { useAddShow, useMyShows, useRemoveShow } from "@/api/me";

export function MyShowsToggle({ showId }: { showId: number }) {
  const { user } = useAuth();
  const { data } = useMyShows();
  const add = useAddShow();
  const remove = useRemoveShow();

  if (!user) return null;
  const tracked = !!data?.find((e) => e.show.id === showId);
  const pending = add.isPending || remove.isPending;

  function onClick() {
    if (tracked) remove.mutate(showId);
    else add.mutate(showId);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`rounded border px-3 py-1 text-sm ${
        tracked
          ? "border-border bg-background text-foreground"
          : "border-foreground bg-foreground text-background"
      } disabled:opacity-50`}
    >
      {tracked ? "Remove from My Shows" : "Add to My Shows"}
    </button>
  );
}
