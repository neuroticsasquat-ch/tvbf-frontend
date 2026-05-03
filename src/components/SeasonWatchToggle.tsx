import { CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useMarkSeason, useUnmarkSeason, useWatchedEpisodes } from "@/api/me";
import { useShowEpisodes } from "@/api/shows";
import { Button } from "@/components/ui/button";

export function SeasonWatchToggle({ showId, season }: { showId: number; season: number }) {
  const { user } = useAuth();
  const { data: episodes } = useShowEpisodes(showId, season);
  const { data: watched } = useWatchedEpisodes(showId, !!user);
  const mark = useMarkSeason();
  const unmark = useUnmarkSeason();

  if (!user) return null;

  const total = episodes?.length ?? 0;
  const watchedInSeason =
    episodes && watched ? episodes.filter((ep) => watched.has(ep.id)).length : 0;
  const fullyWatched = total > 0 && watchedInSeason === total;

  function onClick() {
    if (fullyWatched) unmark.mutate({ showId, season });
    else mark.mutate({ showId, season });
  }

  return (
    <Button
      type="button"
      variant={fullyWatched ? "outline" : "default"}
      size="sm"
      onClick={onClick}
      disabled={total === 0}
      aria-pressed={fullyWatched}
      title={fullyWatched ? "Season fully watched — click to unmark" : "Click to mark season watched"}
      className={fullyWatched ? "text-emerald-700" : undefined}
    >
      {fullyWatched ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
      {fullyWatched ? "Season watched" : "Mark season watched"}
    </Button>
  );
}
