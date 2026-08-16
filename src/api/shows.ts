import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildShowsQuery } from "./client";
import type {
  AnticipatedShow,
  CastMember,
  CrewMember,
  EpisodeOut,
  GenreOut,
  ShowDetail,
  ShowFilters,
  ShowListPage,
  ShowSummary,
  TrendingSnapshot,
} from "./types";

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export function useGenres() {
  return useQuery<GenreOut[]>({
    queryKey: ["genres"],
    queryFn: () => apiFetch<GenreOut[]>("/genres"),
    staleTime: ONE_HOUR,
  });
}

export function useShows(filters: ShowFilters, options: { enabled?: boolean } = {}) {
  const queryString = buildShowsQuery(filters);
  return useQuery<ShowListPage>({
    queryKey: ["shows", filters],
    // `signal` aborts a superseded search request instead of leaving it in
    // flight — search fires one of these per (debounced) keystroke.
    queryFn: ({ signal }) =>
      apiFetch<ShowListPage>(`/shows${queryString ? `?${queryString}` : ""}`, { signal }),
    staleTime: FIVE_MINUTES,
    enabled: options.enabled ?? true,
  });
}

export function useShow(id: number) {
  return useQuery<ShowDetail>({
    queryKey: ["show", id],
    queryFn: () => apiFetch<ShowDetail>(`/shows/${id}`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** TMDB's "More like this" for one show (NEU-1053).
 *
 * The list arrives ready to render: capped at 12 and filtered for `adult` /
 * `deleted_upstream_at` on the server, in TMDB's own rank order. So this client
 * never slices it and never re-sorts it — the cap is applied *after* the
 * filters, so a client re-slicing a pre-filtered list would show fewer than
 * twelve the first time a tombstone landed, and the rank order is the only
 * ordering in the payload that carries information.
 *
 * `genres`, `network` and `my_rating` come back empty by design — `ShowCard`
 * renders none of them, and filling them would cost the route the shared cache
 * it keeps by carrying no per-user field.
 *
 * A show with no recommendations answers `200 []` (roughly 8% of the long
 * tail); an unknown show 404s, which this never sees — the section only mounts
 * under a show that already resolved.
 */
export function useSimilarShows(id: number) {
  return useQuery<ShowSummary[]>({
    queryKey: ["show-similar", id],
    queryFn: () => apiFetch<ShowSummary[]>(`/shows/${id}/similar`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** TMDB's trending list for the week (NEU-1056).
 *
 * The list arrives ready to render, in TMDB's own rank order, so this client
 * never slices it and never re-sorts it — the rank is a position rather than a
 * number the payload carries, and it is the only ordering here that means
 * anything.
 *
 * **The staleness rule is not re-implemented here, and must never be.** A
 * snapshot past seven days comes back as the same `{captured_at: null, shows:
 * []}` an empty table gives, so there is nothing to check and nothing to say —
 * the surface renders no content, and the user is never shown the word "stale"
 * (contract §3, §4).
 *
 * `staleTime: 0` matching `useRecommendations`: the route answers
 * `Cache-Control: no-store` because `in_my_shows` makes the body per-user.
 */
export function useTrending() {
  return useQuery<TrendingSnapshot>({
    queryKey: ["trending"],
    queryFn: () => apiFetch<TrendingSnapshot>("/trending"),
    staleTime: 0,
  });
}

/** The shows premiering soonest that most people are waiting for (NEU-1059).
 *
 * A **live query** rather than a snapshot, which is what removes three rules
 * `useTrending` needs: a show cannot linger after it premieres
 * (`first_air_date >= current_date` is evaluated on the read), there is no run
 * to fail, and there is no staleness cutoff — nothing is stored, so the
 * payload carries no timestamp to measure and this client must not invent one
 * (contract §3).
 *
 * The list arrives ready to render — popularity order, server-side window and
 * length — so this client never slices it and never re-sorts it. Empty is
 * `200 []` and the surface renders no content at all (contract §4).
 *
 * `staleTime: 0` matching `useTrending`: the route answers `no-store` because
 * `in_my_shows` makes the body per-user *and* user-mutable, so a cached body
 * would revert a My Shows toggle.
 */
export function useAnticipated() {
  return useQuery<AnticipatedShow[]>({
    queryKey: ["anticipated"],
    queryFn: () => apiFetch<AnticipatedShow[]>("/anticipated"),
    staleTime: 0,
  });
}

export function useEpisode(id: number) {
  return useQuery<EpisodeOut>({
    queryKey: ["episode", id],
    queryFn: () => apiFetch<EpisodeOut>(`/episodes/${id}`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Ordering is the API's, never this client's. Since NEU-1047 that is
 * descending `episode_count` — the real count that TV Maze's billing order only
 * ever proxied for. */
export function useShowCast(id: number) {
  return useQuery<CastMember[]>({
    queryKey: ["show-cast", id],
    queryFn: () => apiFetch<CastMember[]>(`/shows/${id}/cast`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Guest cast for one episode. Same payload shape as show cast, so the same
 * `CastList` renders it. A known episode with no guest cast returns `[]` and a
 * 200 — that's 96% of the catalog, and not a failure. (The route does 404 an
 * *unknown* episode id, which this never sees: the section only mounts after
 * the episode itself resolves.)
 *
 * Deferring the request behind a viewport observer would make that 96% cost
 * zero requests, which is the cheaper option and was weighed. Rejected: the
 * section sits within the first viewport on most episode pages, so the
 * observer would fire immediately and save nothing, while costing a jsdom
 * polyfill and a late pop-in on the 4% that do have guests. Revisit if episode
 * pages ever grow long enough that it's genuinely below the fold. */
export function useEpisodeGuestCast(id: number) {
  return useQuery<CastMember[]>({
    queryKey: ["episode-guest-cast", id],
    queryFn: () => apiFetch<CastMember[]>(`/episodes/${id}/guest-cast`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Episode crew — director, writer, story, teleplay. Shares `CrewMember` with
 * show crew because the API serves both through `CrewMemberOut` (NEU-963); the
 * two differ in grain and vocabulary, not in payload shape. */
export function useEpisodeCrew(id: number) {
  return useQuery<CrewMember[]>({
    queryKey: ["episode-crew", id],
    queryFn: () => apiFetch<CrewMember[]>(`/episodes/${id}/crew`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useShowCrew(id: number) {
  return useQuery<CrewMember[]>({
    queryKey: ["show-crew", id],
    queryFn: () => apiFetch<CrewMember[]>(`/shows/${id}/crew`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useShowEpisodes(id: number, season?: number, options: { enabled?: boolean } = {}) {
  const suffix = season !== undefined ? `?season=${season}` : "";
  const enabled = (options.enabled ?? true) && Number.isFinite(id) && id > 0;
  return useQuery<EpisodeOut[]>({
    queryKey: ["show-episodes", id, season ?? null],
    queryFn: () => apiFetch<EpisodeOut[]>(`/shows/${id}/episodes${suffix}`),
    staleTime: FIVE_MINUTES,
    enabled,
  });
}
