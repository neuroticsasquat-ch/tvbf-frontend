import { CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useMarkEpisode, useUnmarkEpisode, useWatchedEpisodes } from "@/api/me";
import { Button } from "@/components/ui/button";

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

  const watched = watchedSet?.has(episodeId) ?? false;

  function onClick() {
    if (watched) unmark.mutate({ episodeId, showId });
    else mark.mutate({ episodeId, showId });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-pressed={watched}
      aria-label={watched ? "Mark episode unwatched" : "Mark episode watched"}
      title={watched ? "Watched — click to unmark" : "Not watched — click to mark watched"}
      className={
        watched
          ? "text-emerald-600 hover:text-emerald-700"
          : "text-muted-foreground hover:text-foreground"
      }
    >
      {watched ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
    </Button>
  );
}
