import { ChevronLeft, ChevronRight, Film } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useEpisode, useEpisodeCrew, useEpisodeGuestCast, useShow, useShowEpisodes } from "@/api/shows";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import { CollapsibleSummary } from "@/components/CollapsibleSummary";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";
import { EpisodeGuestCast } from "@/components/EpisodeGuestCast";
import { EpisodeCrew } from "@/components/EpisodeCrew";
import { EpisodeFriendsWatched } from "@/components/friends/FriendActivity";
import { FriendRatingsList } from "@/components/FriendRatingsList";
import { FilterSheet } from "@/components/home/FilterSheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingBadge } from "@/components/RatingBadge";
import { StarRatingInput } from "@/components/StarRatingInput";
import { tenPointToFiveStar } from "@/lib/rating";
import { seasonLabel } from "@/lib/season";
import { useEpisodeRating } from "@/api/me";
import { useAuth } from "@/components/AuthContext";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const id = Number(episodeId);
  const episodeQuery = useEpisode(id);
  const { user } = useAuth();
  const rate = useEpisodeRating(id);
  const showQuery = useShow(episodeQuery.data?.show_id ?? -1);
  const seasonEpisodesQuery = useShowEpisodes(
    episodeQuery.data?.show_id ?? -1,
    episodeQuery.data?.season,
  );

  // Fetched here for the region gate and tab counts. EpisodeGuestCast/EpisodeCrew
  // run the same queries and React Query dedupes on the key, so this costs no
  // extra request.
  const guestQuery = useEpisodeGuestCast(id);
  const crewQuery = useEpisodeCrew(id);

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

  const guestCount = guestQuery.data?.length ?? 0;
  const crewCount = crewQuery.data?.length ?? 0;
  const guestEmpty = guestQuery.isSuccess && guestCount === 0;
  const crewEmpty = crewQuery.isSuccess && crewCount === 0;

  const showCredits =
    crewCount > 0 || guestCount > 0 || crewQuery.isError || guestQuery.isError;

  const requested = searchParams.get("tab");
  const wanted = requested === "crew" || requested === "guest-cast" ? requested : "crew";
  const tab =
    wanted === "crew" && crewEmpty
      ? "guest-cast"
      : wanted === "guest-cast" && guestEmpty
        ? "crew"
        : wanted;

  function selectTab(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "crew") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  // The season row carries the name; until the show query resolves, fall back to
  // the number the episode itself knows. Computed after the `ep` guard so the
  // fallback can use a real season number — a placeholder here would print
  // "Season 0", the one string this ticket exists to remove.
  const currentSeasonLabel = seasonLabel(seasonsList[seasonIdx] ?? { number: ep.season });

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
            aria-label={`Back to ${currentSeasonLabel}`}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-sm hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            {currentSeasonLabel}
          </Link>
        </div>
        <h1 className="text-2xl font-semibold">
          <FilterSheet
            title={currentSeasonLabel}
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
        {(ep.airdate || ep.runtime || ep.rating_average != null) && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {ep.airdate ? <span>{formatAirdate(ep.airdate)}</span> : null}
            {ep.airdate && ep.runtime ? <span aria-hidden>·</span> : null}
            {ep.runtime ? <span>{ep.runtime} min</span> : null}
            <RatingBadge
              kind="aggregate"
              crowdName="TMDB"
              value={tenPointToFiveStar(ep.rating_average)}
            />
          </p>
        )}
        {user ? (
          <section>
            <h2 className="text-base font-semibold">Your rating</h2>
            <StarRatingInput value={ep.my_rating} onChange={(next) => rate.mutate(next)} />
          </section>
        ) : null}
        <EpisodeFriendsWatched episodeId={ep.id} />
        <FriendRatingsList episodeId={ep.id} />
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
            <CollapsibleSummary html={ep.summary} className="prose prose-sm max-w-none" />
          ) : (
            <p className="text-sm text-muted-foreground">No summary available.</p>
          )}
        </div>
      </div>

      {showCredits && (
        <Tabs value={tab} onValueChange={selectTab}>
          <TabsList>
            <TabsTrigger value="crew" disabled={crewEmpty}>
              Crew {crewQuery.isSuccess && <TabCount value={crewCount} />}
            </TabsTrigger>
            <TabsTrigger value="guest-cast" disabled={guestEmpty}>
              Guest cast {guestQuery.isSuccess && <TabCount value={guestCount} />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crew">
            <EpisodeCrew episodeId={ep.id} headingHidden />
          </TabsContent>
          <TabsContent value="guest-cast">
            <EpisodeGuestCast episodeId={ep.id} headingHidden />
          </TabsContent>
        </Tabs>
      )}
    </article>
  );
}

/** The count beside a tab label. Muted so the label stays the thing you read. */
function TabCount({ value }: { value: number }) {
  return <span className="font-normal text-muted-foreground">({value})</span>;
}
