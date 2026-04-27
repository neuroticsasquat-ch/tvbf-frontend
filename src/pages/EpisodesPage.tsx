import { Link, useParams, useSearchParams } from "react-router";
import { useShow, useShowEpisodes } from "@/api/shows";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";
import { SeasonWatchToggle } from "@/components/SeasonWatchToggle";

export function EpisodesPage() {
  const { id } = useParams<{ id: string }>();
  const showId = Number(id);
  const [params, setParams] = useSearchParams();
  const seasonParam = params.get("season");
  const season = seasonParam ? Number(seasonParam) : undefined;

  const showQuery = useShow(showId);
  const episodesQuery = useShowEpisodes(showId, season);

  if (showQuery.isError && showQuery.error instanceof ApiError && showQuery.error.status === 404) {
    return <NotFoundPage />;
  }
  if (showQuery.isPending || episodesQuery.isPending) return <LoadingState rows={1} />;
  if (showQuery.isError) {
    return <ErrorState message={showQuery.error.message} onRetry={() => showQuery.refetch()} />;
  }
  if (episodesQuery.isError) {
    return (
      <ErrorState
        message={episodesQuery.error.message}
        onRetry={() => episodesQuery.refetch()}
      />
    );
  }

  const currentSeason = season ?? showQuery.data.seasons[0]?.number ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{showQuery.data.name}</h1>
          <Link to={`/shows/${showId}`} className="text-sm text-muted-foreground underline">
            Back to show
          </Link>
        </div>
        <div>
          <Label htmlFor="season">Season</Label>
          <Select
            value={String(currentSeason)}
            onValueChange={(v) => {
              const next = new URLSearchParams(params);
              next.set("season", v);
              setParams(next);
            }}
          >
            <SelectTrigger id="season" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {showQuery.data.seasons.map((s) => (
                <SelectItem key={s.id} value={String(s.number)}>
                  Season {s.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SeasonWatchToggle showId={showId} season={currentSeason} />

      {episodesQuery.data.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No episodes for this season.</p>
      ) : (
        <ul className="divide-y divide-border rounded border border-border">
          {episodesQuery.data.map((ep) => (
            <li key={ep.id} className="flex items-stretch">
              <div className="flex w-12 shrink-0 items-center justify-center self-stretch border-r border-border bg-muted/40 text-sm font-medium tabular-nums text-muted-foreground">
                {ep.number ?? "—"}
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{ep.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {ep.airdate ?? "TBA"}
                    {ep.runtime ? ` · ${ep.runtime} min` : ""}
                  </div>
                </div>
                <EpisodeWatchCheckbox showId={ep.show_id} episodeId={ep.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
