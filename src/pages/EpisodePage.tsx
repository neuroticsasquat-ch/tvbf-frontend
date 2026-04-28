import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { useEpisode, useShow, useShowEpisodes } from "@/api/shows";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import { SafeHtml } from "@/components/SafeHtml";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";
import { Button } from "@/components/ui/button";

export function EpisodePage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();
  const id = Number(episodeId);
  const episodeQuery = useEpisode(id);
  const showQuery = useShow(episodeQuery.data?.show_id ?? -1);
  const seasonEpisodesQuery = useShowEpisodes(
    episodeQuery.data?.show_id ?? -1,
    episodeQuery.data?.season,
  );

  if (
    episodeQuery.isError &&
    episodeQuery.error instanceof ApiError &&
    episodeQuery.error.status === 404
  ) {
    return <NotFoundPage />;
  }
  if (episodeQuery.isPending) return <LoadingState rows={1} />;
  if (episodeQuery.isError) {
    return (
      <ErrorState
        message={episodeQuery.error.message}
        onRetry={() => episodeQuery.refetch()}
      />
    );
  }

  const ep = episodeQuery.data;
  const show = showQuery.data;
  const seasonEpisodes = seasonEpisodesQuery.data ?? [];
  const idx = seasonEpisodes.findIndex((e) => e.id === ep.id);
  const prev = idx > 0 ? seasonEpisodes[idx - 1] : undefined;
  const next = idx >= 0 && idx < seasonEpisodes.length - 1 ? seasonEpisodes[idx + 1] : undefined;

  return (
    <article className="space-y-4">
      <div className="space-y-1">
        {show ? (
          <Link to={`/shows/${ep.show_id}`} className="text-sm text-muted-foreground underline">
            {show.name}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold">
          {ep.name ?? `Episode ${ep.number ?? ""}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          S{ep.season}E{ep.number ?? "—"}
          {ep.airdate ? ` · ${ep.airdate}` : ""}
          {ep.runtime ? ` · ${ep.runtime} min` : ""}
        </p>
        <Link
          to={`/shows/${ep.show_id}/episodes?season=${ep.season}`}
          className="text-sm text-muted-foreground underline"
        >
          Back to season {ep.season}
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!prev}
          onClick={() => prev && navigate(`/episodes/${prev.id}`)}
          aria-label="Previous episode"
        >
          <ChevronLeft aria-hidden />
          {prev ? `S${prev.season}E${prev.number ?? "—"}` : "Previous"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!next}
          onClick={() => next && navigate(`/episodes/${next.id}`)}
          aria-label="Next episode"
        >
          {next ? `S${next.season}E${next.number ?? "—"}` : "Next"}
          <ChevronRight aria-hidden />
        </Button>
      </div>

      <div className="flex items-start gap-4">
        {ep.image_original || ep.image_medium ? (
          <img
            src={ep.image_original ?? ep.image_medium ?? ""}
            alt=""
            className="w-48 max-w-[40%] shrink-0 rounded border border-border object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-3">
          <EpisodeWatchCheckbox showId={ep.show_id} episodeId={ep.id} />
          {ep.summary ? (
            <SafeHtml html={ep.summary} className="prose prose-sm max-w-none" />
          ) : (
            <p className="text-sm text-muted-foreground">No summary available.</p>
          )}
        </div>
      </div>
    </article>
  );
}
