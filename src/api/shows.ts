import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildShowsQuery } from "./client";
import type { EpisodeOut, ShowDetail, ShowFilters, ShowListPage } from "./types";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useShows(filters: ShowFilters) {
  const queryString = buildShowsQuery(filters);
  return useQuery<ShowListPage>({
    queryKey: ["shows", filters],
    queryFn: () => apiFetch<ShowListPage>(`/shows${queryString ? `?${queryString}` : ""}`),
    staleTime: FIVE_MINUTES,
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

export function useShowEpisodes(id: number, season?: number) {
  const suffix = season !== undefined ? `?season=${season}` : "";
  return useQuery<EpisodeOut[]>({
    queryKey: ["show-episodes", id, season ?? null],
    queryFn: () => apiFetch<EpisodeOut[]>(`/shows/${id}/episodes${suffix}`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}
