import { useAuth } from "./AuthContext";
import { useMarkEpisode, useUnmarkEpisode, useWatchedEpisodes } from "@/api/me";

export function EpisodeWatchCheckbox({
  showId,
  episodeId,
}: {
  showId: number;
  episodeId: number;
}) {
  const { user } = useAuth();
  const { data: watchedSet } = useWatchedEpisodes(showId, !!user);
  const mark = useMarkEpisode();
  const unmark = useUnmarkEpisode();

  if (!user) return null;

  const checked = watchedSet?.has(episodeId) ?? false;
  const pending = mark.isPending || unmark.isPending;

  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) mark.mutate(episodeId);
    else unmark.mutate(episodeId);
  }

  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={pending}
        aria-label="Mark episode watched"
      />
      <span className="text-xs text-muted-foreground">Watched</span>
    </label>
  );
}
