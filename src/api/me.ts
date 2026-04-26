import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  EpisodeWatchOut,
  MyShowEntry,
  MyShowsSort,
  UpcomingEntry,
  UpcomingSort,
  WatchNextEntry,
  WatchNextSort,
} from "./types";

export function useMyShows(sort: MyShowsSort = "recent_activity") {
  return useQuery<MyShowEntry[]>({
    queryKey: ["my-shows", sort],
    queryFn: () => apiFetch<MyShowEntry[]>(`/me/shows?sort=${sort}`),
  });
}

export function useWatchNext(sort: WatchNextSort = "airdate_desc") {
  return useQuery<WatchNextEntry[]>({
    queryKey: ["watch-next", sort],
    queryFn: () => apiFetch<WatchNextEntry[]>(`/me/watch-next?sort=${sort}`),
  });
}

export function useUpcoming(sort: UpcomingSort = "airdate_asc") {
  return useQuery<UpcomingEntry[]>({
    queryKey: ["upcoming", sort],
    queryFn: () => apiFetch<UpcomingEntry[]>(`/me/upcoming?sort=${sort}`),
  });
}

export function useWatchedEpisodes(showId: number, enabled = true) {
  return useQuery<Set<number>>({
    queryKey: ["watched-episodes", showId],
    queryFn: async () => {
      const ids = await apiFetch<number[]>(`/me/shows/${showId}/episodes/watched`);
      return new Set(ids);
    },
    enabled,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["my-shows"] });
  qc.invalidateQueries({ queryKey: ["watch-next"] });
  qc.invalidateQueries({ queryKey: ["upcoming"] });
  qc.invalidateQueries({ queryKey: ["watched-episodes"] });
}

export function useAddShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) =>
      apiFetch<void>(`/me/shows/${showId}`, { method: "PUT" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRemoveShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) =>
      apiFetch<void>(`/me/shows/${showId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useMarkEpisode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (episodeId: number) =>
      apiFetch<EpisodeWatchOut>(`/me/episodes/${episodeId}/watched`, { method: "POST" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUnmarkEpisode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (episodeId: number) =>
      apiFetch<void>(`/me/episodes/${episodeId}/watched`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useMarkSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { showId: number; season: number }) =>
      apiFetch<{ marked: number }>(
        `/me/shows/${vars.showId}/season/${vars.season}/watched`,
        { method: "POST" },
      ),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUnmarkSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { showId: number; season: number }) =>
      apiFetch<void>(`/me/shows/${vars.showId}/season/${vars.season}/watched`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateAll(qc),
  });
}
