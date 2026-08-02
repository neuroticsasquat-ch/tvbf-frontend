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

/** Cast is served in billing order by the API — never re-sort it client-side. */
export function useShowCast(id: number) {
  return useQuery<CastMember[]>({
    queryKey: ["show-cast", id],
    queryFn: () => apiFetch<CastMember[]>(`/shows/${id}/cast`),
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
