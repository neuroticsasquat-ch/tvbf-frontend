import { useWatchNext } from "@/api/me";

export function NextEpisodeCard({ showId }: { showId: number }) {
  const { data } = useWatchNext();
  const entry = data?.find((e) => e.show.id === showId);
  if (!entry) return null;
  const ep = entry.episode;
  return (
    <aside className="rounded border border-border p-3 bg-muted">
      <h3 className="text-sm font-semibold">Next up</h3>
      <p className="text-sm">
        S{ep.season}E{ep.number}
        {ep.name ? ` — ${ep.name}` : ""}
      </p>
      {ep.airdate && <p className="text-xs text-muted-foreground">Aired {ep.airdate}</p>}
    </aside>
  );
}
