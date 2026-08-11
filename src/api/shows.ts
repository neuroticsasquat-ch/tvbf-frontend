import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildShowsQuery } from "./client";
import type {
  CastMember,
  CrewMember,
  EpisodeOut,
  GenreOut,
  ShowDetail,
  ShowFilters,
  ShowListPage,
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

export function useEpisode(id: number) {
  return useQuery<EpisodeOut>({
    queryKey: ["episode", id],
    queryFn: () => apiFetch<EpisodeOut>(`/episodes/${id}`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Ordering is the API's, never this client's. Today that is TV Maze billing
 * order; once the credits routes read `catalog` (NEU-1047) it becomes
 * descending `episode_count`, the real count billing order only proxied for. */
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
