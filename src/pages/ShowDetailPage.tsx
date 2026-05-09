import { useState } from "react";
import { Link, useParams } from "react-router";
import { useShow } from "@/api/shows";
import { useAuth } from "@/components/AuthContext";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import { SafeHtml } from "@/components/SafeHtml";
import { Badge } from "@/components/ui/badge";
import { MyShowsToggle } from "@/components/MyShowsToggle";
import { ShowWatchCheckbox } from "@/components/ShowWatchCheckbox";
import { NextEpisodeCard } from "@/components/NextEpisodeCard";
import { ShowFriendActivityStrip } from "@/components/friends/FriendActivity";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { SeasonWatchCheckbox } from "@/components/SeasonWatchCheckbox";
import { useMyShows, useSeasonProgress } from "@/api/me";
import { Tv } from "lucide-react";

function yearRange(premiered: string | null, ended: string | null) {
  if (!premiered) return "—";
  const start = premiered.slice(0, 4);
  const end = ended ? ended.slice(0, 4) : "present";
  return start === end ? start : `${start} – ${end}`;
}

export function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const showId = Number(id);
  const query = useShow(showId);
  const myShowsQuery = useMyShows();
  const myEntry = myShowsQuery.data?.find((e) => e.show.id === showId);
  const { user } = useAuth();
  const progressQuery = useSeasonProgress(showId, !!user && !!myEntry);
  const [seasonFilter, setSeasonFilter] = useState<"all" | "unwatched">("all");

  if (query.isPending) return <LoadingState rows={1} />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />;
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  }
  const show = query.data;
  return (
    <article className="space-y-6">
      <header className="flex flex-col gap-6 sm:flex-row">
        {show.image_medium ? (
          <img
            src={show.image_medium}
            alt=""
            className="w-40 self-start rounded border border-border"
          />
        ) : null}
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-semibold">{show.name}</h1>
          <p className="text-sm text-muted-foreground">
            {yearRange(show.premiered, show.ended)}
            {show.network?.name ? ` · ${show.network.name}` : ""}
            {show.status ? ` · ${show.status}` : ""}
            {show.runtime ? ` · ${show.runtime} min` : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            {show.genres.map((g) => (
              <Badge key={g} variant="secondary">
                {g}
              </Badge>
            ))}
          </div>
          <SafeHtml html={show.summary} className="prose prose-sm max-w-none pt-2" />
          {myEntry && myEntry.aired_episode_count > 0 ? (
            <div className="pt-2">
              <WatchProgressBar
                watched={myEntry.watched_episode_count}
                aired={myEntry.aired_episode_count}
                upcoming={myEntry.upcoming_episode_count}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <MyShowsToggle showId={show.id} />
            {myEntry && (
              <ShowWatchCheckbox
                showId={show.id}
                watchedCount={myEntry.watched_episode_count}
                airedCount={myEntry.aired_episode_count}
              />
            )}
          </div>
        </div>
      </header>

      <ShowFriendActivityStrip showId={show.id} />

      <NextEpisodeCard showId={show.id} />

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Seasons{" "}
            <span className="font-normal text-muted-foreground">({show.seasons.length})</span>
          </h2>
          {myEntry && progressQuery.data && (
            <div
              role="radiogroup"
              aria-label="Filter seasons"
              className="inline-flex rounded border border-border text-sm"
            >
              {(["all", "unwatched"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={seasonFilter === key}
                  onClick={() => setSeasonFilter(key)}
                  className={`px-3 py-1 capitalize ${
                    seasonFilter === key
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
        {(() => {
          const progressMap = new Map((progressQuery.data ?? []).map((p) => [p.season, p]));
          const filtered =
            seasonFilter === "unwatched" && myEntry
              ? show.seasons.filter((s) => {
                  const p = progressMap.get(s.number);
                  return p ? p.aired > p.watched : false;
                })
              : show.seasons;
          if (show.seasons.length === 0) {
            return <p className="text-sm text-muted-foreground">No seasons available.</p>;
          }
          if (filtered.length === 0) {
            return <p className="text-sm text-muted-foreground">No unwatched seasons.</p>;
          }
          return (
            <ul className="space-y-3">
              {filtered.map((s) => {
                const p = progressMap.get(s.number);
                const aired = p?.aired ?? 0;
                const watched = p?.watched ?? 0;
                const upcoming =
                  (s.episode_order ?? 0) > aired ? (s.episode_order ?? 0) - aired : 0;
                const year = s.premiere_date ? s.premiere_date.slice(0, 4) : null;
                const title = s.name && s.name !== `Season ${s.number}` ? s.name : null;
                const thumbnail = s.image_medium ?? show.image_medium;
                return (
                  <li key={s.id} className="border border-border rounded p-3 hover:bg-accent">
                    <div className="flex items-center gap-4">
                      <Link
                        to={`/shows/${show.id}/episodes?season=${s.number}`}
                        className="flex flex-1 min-w-0 items-center gap-4"
                      >
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt=""
                            className="w-20 aspect-[210/295] object-cover rounded shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            aria-hidden
                            className="w-20 aspect-[210/295] rounded shrink-0 bg-muted text-muted-foreground flex items-center justify-center"
                          >
                            <Tv className="h-6 w-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-base text-foreground leading-tight truncate">
                            Season {s.number}
                            {title && (
                              <>
                                {" — "}
                                <span className="font-semibold">{title}</span>
                              </>
                            )}
                            {year && <span className="text-muted-foreground"> — {year}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground leading-tight">
                            {s.episode_order ?? "?"} episodes
                          </p>
                          {myEntry && p && aired > 0 && (
                            <WatchProgressBar watched={watched} aired={aired} upcoming={upcoming} />
                          )}
                        </div>
                      </Link>
                      {myEntry && aired > 0 && (
                        <div className="ml-auto shrink-0">
                          <SeasonWatchCheckbox
                            showId={show.id}
                            season={s.number}
                            aired={aired}
                            watched={watched}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        })()}
      </section>
    </article>
  );
}
