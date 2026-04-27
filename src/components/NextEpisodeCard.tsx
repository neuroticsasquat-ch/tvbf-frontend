import { useWatchNext } from "@/api/me";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";

export function NextEpisodeCard({ showId }: { showId: number }) {
  const { data } = useWatchNext();
  const entry = data?.find((e) => e.show.id === showId);
  if (!entry) return null;
  const ep = entry.episode;
  return (
    <aside className="flex items-center gap-3 rounded border border-border bg-muted p-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">Next up</h3>
        <p className="text-sm">
          S{ep.season}E{ep.number}
          {ep.name ? ` — ${ep.name}` : ""}
        </p>
        {ep.airdate && <p className="text-xs text-muted-foreground">Aired {ep.airdate}</p>}
      </div>
      <EpisodeWatchCheckbox showId={showId} episodeId={ep.id} />
    </aside>
  );
}
