import { useState } from "react";
import { ChevronLeft, ChevronRight, Layers, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams, useSearchParams } from "react-router";
import { useShow, useShowEpisodes } from "@/api/shows";
import { ApiError } from "@/api/client";
import { useAuth } from "@/components/AuthContext";
import { useWatchedEpisodes } from "@/api/me";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import { FilterSheet } from "@/components/home/FilterSheet";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";
import { SeasonWatchToggle } from "@/components/SeasonWatchToggle";
import { SafeHtml } from "@/components/SafeHtml";

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EpisodesPage() {
  const { id } = useParams<{ id: string }>();
  const showId = Number(id);
  const [params, setParams] = useSearchParams();
  const seasonParam = params.get("season");
  const season = seasonParam ? Number(seasonParam) : undefined;
  const [episodeFilter, setEpisodeFilter] = useState<"all" | "unwatched">("all");

  const showQuery = useShow(showId);
  const episodesQuery = useShowEpisodes(showId, season);
  const { user } = useAuth();
  const watchedQuery = useWatchedEpisodes(showId, !!user);

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
  const seasonsList = showQuery.data.seasons;
  const seasonIdx = seasonsList.findIndex((s) => s.number === currentSeason);
  const prevSeasonNumber = seasonIdx > 0 ? seasonsList[seasonIdx - 1].number : undefined;
  const nextSeasonNumber =
    seasonIdx >= 0 && seasonIdx < seasonsList.length - 1
      ? seasonsList[seasonIdx + 1].number
      : undefined;
  const currentSeasonData = seasonsList.find((s) => s.number === currentSeason);
  const seasonImage = currentSeasonData?.image_medium ?? showQuery.data.image_medium;
  const goToSeason = (n: number) => {
    const next = new URLSearchParams(params);
    next.set("season", String(n));
    setParams(next);
  };
  const today = todayIso();
  const watched = watchedQuery.data;
  const filteredEpisodes =
    episodeFilter === "unwatched" && user
      ? episodesQuery.data.filter((ep) => {
          const aired = !!ep.airdate && ep.airdate <= today;
          if (!aired) return false;
          return !(watched?.has(ep.id) ?? false);
        })
      : episodesQuery.data;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-6 sm:flex-row">
        {seasonImage ? (
          <img
            src={seasonImage}
            alt=""
            className="w-40 self-start rounded border border-border"
          />
        ) : null}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/shows/${showId}`}
              aria-label={`Back to ${showQuery.data.name}`}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-sm hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              {showQuery.data.name}
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">
            <FilterSheet
              title={showQuery.data.name}
              triggerLabel={`Season ${currentSeason}`}
              triggerIcon={<Layers className="h-5 w-5 text-muted-foreground" aria-hidden />}
              ariaLabel={`Select season (current: Season ${currentSeason})`}
              options={seasonsList.map((s) => ({
                key: String(s.number),
                label: `Season ${s.number}`,
              }))}
              value={String(currentSeason)}
              onChange={(v) => goToSeason(Number(v))}
              triggerClassName="w-full text-2xl font-semibold"
            />
          </h1>
          {currentSeasonData?.summary && (
            <SafeHtml
              html={currentSeasonData.summary}
              className="prose prose-sm max-w-none pt-2"
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SeasonWatchToggle showId={showId} season={currentSeason} />
            <div className="inline-flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={prevSeasonNumber === undefined}
                onClick={() => prevSeasonNumber !== undefined && goToSeason(prevSeasonNumber)}
                aria-label="Previous season"
                className="w-24 rounded-r-none"
              >
                <ChevronLeft aria-hidden />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={nextSeasonNumber === undefined}
                onClick={() => nextSeasonNumber !== undefined && goToSeason(nextSeasonNumber)}
                aria-label="Next season"
                className="-ml-px w-24 rounded-l-none"
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Episodes{" "}
            <span className="font-normal text-muted-foreground">
              ({episodesQuery.data.length})
            </span>
          </h2>
          {user && (
            <div role="radiogroup" aria-label="Filter episodes" className="inline-flex rounded border border-border text-sm">
              {(["all", "unwatched"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={episodeFilter === key}
                  onClick={() => setEpisodeFilter(key)}
                  className={`px-3 py-1 capitalize ${
                    episodeFilter === key
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>

        {episodesQuery.data.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">No episodes for this season.</p>
        ) : filteredEpisodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unwatched episodes.</p>
        ) : (
          <ul className="space-y-3">
            {filteredEpisodes.map((ep) => {
              const thumbnail = ep.image_medium ?? seasonImage;
              return (
                <li
                  key={ep.id}
                  className="border border-border rounded p-3 hover:bg-accent"
                >
                  <div className="flex items-center gap-4">
                    <Link
                      to={`/episodes/${ep.id}`}
                      className="flex min-w-0 flex-1 items-center gap-4"
                    >
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt=""
                          className="w-32 aspect-video object-cover rounded shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="w-32 aspect-video rounded shrink-0 bg-muted text-muted-foreground flex items-center justify-center"
                        >
                          <Tv className="h-6 w-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground leading-tight">
                          S{ep.season}E{ep.number ?? "—"}
                        </p>
                        {ep.name && (
                          <p className="text-sm font-semibold text-foreground leading-tight truncate">
                            {ep.name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground leading-tight">
                          {ep.airdate ? formatAirdate(ep.airdate) : "TBA"}
                          {ep.runtime ? ` · ${ep.runtime} min` : ""}
                        </p>
                      </div>
                    </Link>
                    <div className="ml-auto shrink-0">
                      <EpisodeWatchCheckbox showId={ep.show_id} episodeId={ep.id} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
