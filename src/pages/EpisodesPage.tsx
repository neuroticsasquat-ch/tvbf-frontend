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
import { SafeHtml } from "@/components/SafeHtml";

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

      {episodesQuery.data.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No episodes for this season.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">#</th>
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Airdate</th>
              <th className="py-2 pr-4 font-medium">Runtime</th>
              <th className="py-2 pr-4 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {episodesQuery.data.map((ep) => (
              <tr key={ep.id} className="border-b border-border align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{ep.number ?? "—"}</td>
                <td className="py-2 pr-4 font-medium">{ep.name ?? "—"}</td>
                <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                  {ep.airdate ?? "—"}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                  {ep.runtime ? `${ep.runtime} min` : "—"}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  <SafeHtml html={ep.summary} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
