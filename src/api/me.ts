import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type {
  EpisodeOut,
  EpisodeWatchOut,
  MyShowEntry,
  MyShowsSort,
  UpcomingEntry,
  UpcomingSort,
  WatchNextEntry,
} from "./types";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useMyShows(sort: MyShowsSort = "recent_activity") {
  return useQuery<MyShowEntry[]>({
    queryKey: ["my-shows", sort],
    queryFn: () => apiFetch<MyShowEntry[]>(`/me/shows?sort=${sort}`),
    staleTime: FIVE_MINUTES,
  });
}

export function useWatchNext() {
  return useQuery<WatchNextEntry[]>({
    queryKey: ["watch-next"],
    queryFn: () => apiFetch<WatchNextEntry[]>(`/me/watch-next`),
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

function placeholderMyShowEntry(showId: number): MyShowEntry {
  return {
    show: {
      id: showId,
      name: "",
      type: null,
      status: null,
      language: null,
      premiered: null,
      ended: null,
      image_medium: null,
      image_original: null,
      network: null,
      web_channel: null,
      genres: [],
    },
    watched_episode_count: 0,
    total_episode_count: 0,
    next_episode: null,
    added_at: new Date().toISOString(),
  };
}

export function useAddShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) =>
      apiFetch<void>(`/me/shows/${showId}`, { method: "PUT" }),
    onMutate: async (showId: number) => {
      await qc.cancelQueries({ queryKey: ["my-shows"] });
      const snapshots = qc.getQueriesData<MyShowEntry[]>({ queryKey: ["my-shows"] });
      qc.setQueriesData<MyShowEntry[]>({ queryKey: ["my-shows"] }, (prev) => {
        if (!prev) return prev;
        if (prev.some((e) => e.show.id === showId)) return prev;
        return [placeholderMyShowEntry(showId), ...prev];
      });
      return { snapshots };
    },
    onError: (_err, _showId, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useRemoveShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) =>
      apiFetch<void>(`/me/shows/${showId}`, { method: "DELETE" }),
    onMutate: async (showId: number) => {
      await qc.cancelQueries({ queryKey: ["my-shows"] });
      const snapshots = qc.getQueriesData<MyShowEntry[]>({ queryKey: ["my-shows"] });
      qc.setQueriesData<MyShowEntry[]>({ queryKey: ["my-shows"] }, (prev) =>
        prev?.filter((e) => e.show.id !== showId),
      );
      return { snapshots };
    },
    onError: (_err, _showId, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => invalidateAll(qc),
  });
}

type WatchedKey = readonly ["watched-episodes", number];

function snapshotWatched(qc: ReturnType<typeof useQueryClient>, showId: number) {
  const key: WatchedKey = ["watched-episodes", showId];
  const prev = qc.getQueryData<Set<number>>(key);
  return { key, prev };
}

function applyWatchedUpdate(
  qc: ReturnType<typeof useQueryClient>,
  key: WatchedKey,
  prev: Set<number> | undefined,
  fn: (next: Set<number>) => void,
) {
  const next = new Set(prev ?? []);
  fn(next);
  qc.setQueryData(key, next);
}

export function useMarkEpisode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { episodeId: number; showId: number }) =>
      apiFetch<EpisodeWatchOut>(`/me/episodes/${vars.episodeId}/watched`, { method: "POST" }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["watched-episodes", vars.showId] });
      const snap = snapshotWatched(qc, vars.showId);
      applyWatchedUpdate(qc, snap.key, snap.prev, (s) => s.add(vars.episodeId));
      return snap;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useUnmarkEpisode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { episodeId: number; showId: number }) =>
      apiFetch<void>(`/me/episodes/${vars.episodeId}/watched`, { method: "DELETE" }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["watched-episodes", vars.showId] });
      const snap = snapshotWatched(qc, vars.showId);
      applyWatchedUpdate(qc, snap.key, snap.prev, (s) => s.delete(vars.episodeId));
      return snap;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => invalidateAll(qc),
  });
}

function seasonEpisodeIds(
  qc: ReturnType<typeof useQueryClient>,
  showId: number,
  season: number,
): number[] {
  const cached = qc.getQueryData<EpisodeOut[]>(["show-episodes", showId, season]);
  return cached?.map((ep) => ep.id) ?? [];
}

export function useMarkSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { showId: number; season: number }) =>
      apiFetch<{ marked: number }>(
        `/me/shows/${vars.showId}/season/${vars.season}/watched`,
        { method: "POST" },
      ),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["watched-episodes", vars.showId] });
      const snap = snapshotWatched(qc, vars.showId);
      const ids = seasonEpisodeIds(qc, vars.showId, vars.season);
      applyWatchedUpdate(qc, snap.key, snap.prev, (s) => ids.forEach((id) => s.add(id)));
      return snap;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useUnmarkSeason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { showId: number; season: number }) =>
      apiFetch<void>(`/me/shows/${vars.showId}/season/${vars.season}/watched`, {
        method: "DELETE",
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["watched-episodes", vars.showId] });
      const snap = snapshotWatched(qc, vars.showId);
      const ids = seasonEpisodeIds(qc, vars.showId, vars.season);
      applyWatchedUpdate(qc, snap.key, snap.prev, (s) => ids.forEach((id) => s.delete(id)));
      return snap;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => invalidateAll(qc),
  });
}
