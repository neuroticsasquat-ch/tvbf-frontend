import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useMarkEpisode, useUnmarkEpisode, useWatchedEpisodes } from "@/api/me";
import { Button } from "@/components/ui/button";
import type { MyShowEntry, UpcomingEntry, WatchNextEntry } from "@/api/types";

const LIST_KEYS: QueryKey[] = [["watch-next"], ["upcoming"], ["my-shows"]];

type Snapshot<T> = [QueryKey, T | undefined][];

type ListSnapshots = {
  watchNext: Snapshot<WatchNextEntry[]>;
  upcoming: Snapshot<UpcomingEntry[]>;
  myShows: Snapshot<MyShowEntry[]>;
};

export function EpisodeWatchCheckbox({
  showId,
  episodeId,
}: {
  showId: number;
  episodeId: number;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: watchedSet } = useWatchedEpisodes(showId, !!user);
  const mark = useMarkEpisode();
  const unmark = useUnmarkEpisode();

  if (!user) return null;

  const watched = watchedSet?.has(episodeId) ?? false;

  function snapshotLists(): ListSnapshots {
    return {
      watchNext: qc.getQueriesData<WatchNextEntry[]>({ queryKey: ["watch-next"] }),
      upcoming: qc.getQueriesData<UpcomingEntry[]>({ queryKey: ["upcoming"] }),
      myShows: qc.getQueriesData<MyShowEntry[]>({ queryKey: ["my-shows"] }),
    };
  }

  async function restoreLists(snap: ListSnapshots) {
    await Promise.all(LIST_KEYS.map((key) => qc.cancelQueries({ queryKey: key })));
    snap.watchNext.forEach(([key, data]) => qc.setQueryData(key, data));
    snap.upcoming.forEach(([key, data]) => qc.setQueryData(key, data));
    snap.myShows.forEach(([key, data]) => qc.setQueryData(key, data));
  }

  function onClick() {
    if (watched) {
      const snap = snapshotLists();
      unmark.mutate({ episodeId, showId });
      toast("Marked unwatched", {
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreLists(snap);
            mark.mutate({ episodeId, showId });
          },
        },
      });
    } else {
      const snap = snapshotLists();
      mark.mutate({ episodeId, showId });
      toast.success("Marked watched", {
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreLists(snap);
            unmark.mutate({ episodeId, showId });
          },
        },
      });
    }
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
