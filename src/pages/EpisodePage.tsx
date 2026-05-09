import { ChevronLeft, ChevronRight, Film } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { useEpisode, useShow, useShowEpisodes } from "@/api/shows";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import { SafeHtml } from "@/components/SafeHtml";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";
import { FilterSheet } from "@/components/home/FilterSheet";
import { Button } from "@/components/ui/button";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatAirdate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

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

  const ep = episodeQuery.data;
  const show = showQuery.data;
  const seasonEpisodes = seasonEpisodesQuery.data ?? [];
  const idx = ep ? seasonEpisodes.findIndex((e) => e.id === ep.id) : -1;
  const seasonsList = show?.seasons ?? [];
  const seasonIdx = ep ? seasonsList.findIndex((s) => s.number === ep.season) : -1;
  const prevSeasonNumber =
    idx === 0 && seasonIdx > 0 ? seasonsList[seasonIdx - 1].number : undefined;
  const nextSeasonNumber =
    idx >= 0 &&
    idx === seasonEpisodes.length - 1 &&
    seasonIdx >= 0 &&
    seasonIdx < seasonsList.length - 1
      ? seasonsList[seasonIdx + 1].number
      : undefined;
  const prevSeasonEpisodesQuery = useShowEpisodes(ep?.show_id ?? -1, prevSeasonNumber, {
    enabled: prevSeasonNumber !== undefined,
  });
  const nextSeasonEpisodesQuery = useShowEpisodes(ep?.show_id ?? -1, nextSeasonNumber, {
    enabled: nextSeasonNumber !== undefined,
  });

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
      <ErrorState message={episodeQuery.error.message} onRetry={() => episodeQuery.refetch()} />
    );
  }
  if (!ep) return <LoadingState rows={1} />;

  const prevInSeason = idx > 0 ? seasonEpisodes[idx - 1] : undefined;
  const nextInSeason =
    idx >= 0 && idx < seasonEpisodes.length - 1 ? seasonEpisodes[idx + 1] : undefined;
  const prevEps = prevSeasonEpisodesQuery.data;
  const nextEps = nextSeasonEpisodesQuery.data;
  const prev =
    prevInSeason ?? (prevEps && prevEps.length > 0 ? prevEps[prevEps.length - 1] : undefined);
  const next = nextInSeason ?? (nextEps && nextEps.length > 0 ? nextEps[0] : undefined);
  const isFirstEverEpisode = seasonIdx === 0 && idx === 0;
  const isLastEverEpisode =
    seasonIdx === seasonsList.length - 1 && idx === seasonEpisodes.length - 1;

  return (
    <article className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {show ? (
            <Link
              to={`/shows/${ep.show_id}`}
              aria-label={`Back to ${show.name}`}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-sm hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              {show.name}
            </Link>
          ) : null}
          <Link
            to={`/shows/${ep.show_id}/episodes?season=${ep.season}`}
            aria-label={`Back to season ${ep.season}`}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-sm hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            Season {ep.season}
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">
          <FilterSheet
            title={`Season ${ep.season}`}
            triggerLabel={
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-normal text-muted-foreground leading-tight">
                  Episode {ep.number ?? "—"}
                </span>
                <span className="flex items-start gap-1">
                  <Film className="mt-1.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{ep.name ?? `Episode ${ep.number ?? ""}`}</span>
                </span>
              </span>
            }
            ariaLabel={`Select episode (current: ${ep.name ?? `Episode ${ep.number ?? ""}`})`}
            options={seasonEpisodes.map((e) => ({
              key: String(e.id),
              label: `E${e.number ?? "—"}${e.name ? ` — ${e.name}` : ""}`,
            }))}
            value={String(ep.id)}
            onChange={(v) => navigate(`/episodes/${v}`)}
            triggerClassName="w-full text-2xl font-semibold"
            triggerAlign="start"
          />
        </h1>
        {(ep.airdate || ep.runtime) && (
          <p className="text-sm text-muted-foreground">
            {ep.airdate ? formatAirdate(ep.airdate) : ""}
            {ep.airdate && ep.runtime ? " · " : ""}
            {ep.runtime ? `${ep.runtime} min` : ""}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <EpisodeWatchCheckbox showId={ep.show_id} episodeId={ep.id} withLabel />
          <div className="inline-flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFirstEverEpisode || !prev}
              onClick={() => prev && navigate(`/episodes/${prev.id}`)}
              aria-label="Previous episode"
              className="w-24 rounded-r-none"
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLastEverEpisode || !next}
              onClick={() => next && navigate(`/episodes/${next.id}`)}
              aria-label="Next episode"
              className="-ml-px w-24 rounded-l-none"
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start gap-4 md:flex-row">
        {ep.image_original || ep.image_medium ? (
          <img
            src={ep.image_original ?? ep.image_medium ?? ""}
            alt=""
            className="w-full max-w-sm shrink-0 rounded border border-border object-cover md:w-48 md:max-w-[40%]"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-3">
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
