import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "./client";
import { localToday } from "./today";
import type {
  EpisodeOut,
  EpisodeWatchOut,
  MyShowEntry,
  MyShowsSort,
  Rating,
  ShowDetail,
  UpcomingEntry,
  UpcomingSeasonEntry,
  UpcomingShowEntry,
  UpcomingSort,
  WatchedEntry,
  WatchNextEntry,
} from "./types";

const FIVE_MINUTES = 5 * 60 * 1000;

export function fetchMyShows(opts: { sort: MyShowsSort; today: string }): Promise<MyShowEntry[]> {
  return apiFetch<MyShowEntry[]>(`/me/shows?sort=${opts.sort}&today=${opts.today}`);
}

export function useMyShows(sort: MyShowsSort = "recent_activity") {
  const today = localToday();
  return useQuery<MyShowEntry[]>({
    queryKey: ["my-shows", sort, today],
    queryFn: () => fetchMyShows({ sort, today }),
    staleTime: FIVE_MINUTES,
  });
}

export function fetchWatchNext(opts: { today: string }): Promise<WatchNextEntry[]> {
  return apiFetch<WatchNextEntry[]>(`/me/watch-next?today=${opts.today}`);
}

export function useWatchNext() {
  const today = localToday();
  return useQuery<WatchNextEntry[]>({
    queryKey: ["watch-next", today],
    queryFn: () => fetchWatchNext({ today }),
  });
}

export function fetchUpcoming(opts: {
  sort: UpcomingSort;
  today: string;
}): Promise<UpcomingEntry[]> {
  return apiFetch<UpcomingEntry[]>(`/me/upcoming?sort=${opts.sort}&today=${opts.today}`);
}

export function useUpcoming(sort: UpcomingSort = "airdate_asc") {
  const today = localToday();
  return useQuery<UpcomingEntry[]>({
    queryKey: ["upcoming", sort, today],
    queryFn: () => fetchUpcoming({ sort, today }),
  });
}

export function fetchUpcomingSeasons(opts: {
  sort: UpcomingSort;
  today: string;
}): Promise<UpcomingSeasonEntry[]> {
  return apiFetch<UpcomingSeasonEntry[]>(
    `/me/upcoming/seasons?sort=${opts.sort}&today=${opts.today}`,
  );
}

export function useUpcomingSeasons(sort: UpcomingSort = "airdate_asc", enabled = true) {
  const today = localToday();
  return useQuery<UpcomingSeasonEntry[]>({
    queryKey: ["upcoming-seasons", sort, today],
    queryFn: () => fetchUpcomingSeasons({ sort, today }),
    enabled,
  });
}

export function fetchUpcomingShows(opts: {
  sort: UpcomingSort;
  today: string;
}): Promise<UpcomingShowEntry[]> {
  return apiFetch<UpcomingShowEntry[]>(`/me/upcoming/shows?sort=${opts.sort}&today=${opts.today}`);
}

export function useUpcomingShows(sort: UpcomingSort = "airdate_asc", enabled = true) {
  const today = localToday();
  return useQuery<UpcomingShowEntry[]>({
    queryKey: ["upcoming-shows", sort, today],
    queryFn: () => fetchUpcomingShows({ sort, today }),
    enabled,
  });
}

/** Fetch the full watched-history list for the caller. Filtering and sorting
 * happen client-side (matches the Active tab pattern). The backend's `status`
 * and `sort` params still exist for API consumers but the UI ignores them. */
export function fetchMyWatched(): Promise<WatchedEntry[]> {
  return apiFetch<WatchedEntry[]>(`/me/watched`);
}

export function useMyWatched(enabled = true) {
  return useQuery<WatchedEntry[]>({
    queryKey: ["my-watched"],
    queryFn: fetchMyWatched,
    enabled,
  });
}

export interface SeasonProgress {
  season: number;
  aired: number;
  watched: number;
}

export function useSeasonProgress(showId: number, enabled = true) {
  return useQuery<SeasonProgress[]>({
    queryKey: ["season-progress", showId],
    queryFn: () => apiFetch<SeasonProgress[]>(`/me/shows/${showId}/seasons/progress`),
    enabled,
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
  qc.invalidateQueries({ queryKey: ["season-progress"] });
  // Friend engagement may include the caller in the future; keep honest.
  qc.invalidateQueries({ queryKey: ["friend-activity"] });
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
      matched_aka: null,
      rating_average: null,
      my_rating: null,
    },
    watched_episode_count: 0,
    total_episode_count: 0,
    aired_episode_count: 0,
    upcoming_episode_count: 0,
    last_aired: null,
    last_watched_at: null,
    first_watched_at: null,
    next_episode: null,
    added_at: new Date().toISOString(),
  };
}

export function useAddShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) => apiFetch<void>(`/me/shows/${showId}`, { method: "PUT" }),
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
    mutationFn: (showId: number) => apiFetch<void>(`/me/shows/${showId}`, { method: "DELETE" }),
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
      apiFetch<{ marked: number }>(`/me/shows/${vars.showId}/season/${vars.season}/watched`, {
        method: "POST",
      }),
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

export function useMarkShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) =>
      apiFetch<{ marked: number }>(`/me/shows/${showId}/watched`, { method: "POST" }),
    onSettled: () => invalidateAll(qc),
  });
}

/** Bulk-clear the user's watch history for a show (deletes every
 * `user_episode_watch` row). Optimistically removes the row from any cached
 * `["my-watched"]` queries and invalidates dependent caches on success. */
export function useRemoveFromHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { showId: number }) =>
      apiFetch<void>(`/me/shows/${vars.showId}/watched`, { method: "DELETE" }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["my-watched"] });
      const snapshots = qc.getQueriesData<WatchedEntry[]>({
        queryKey: ["my-watched"],
      });
      qc.setQueriesData<WatchedEntry[]>({ queryKey: ["my-watched"] }, (cur) =>
        cur ? cur.filter((e) => e.show.id !== vars.showId) : cur,
      );
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error("Could not remove watch history.");
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["my-shows"] });
      qc.invalidateQueries({ queryKey: ["watch-next"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
      qc.invalidateQueries({ queryKey: ["watched-episodes", vars.showId] });
      qc.invalidateQueries({ queryKey: ["season-progress", vars.showId] });
    },
  });
}

export function useUnmarkShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) =>
      apiFetch<void>(`/me/shows/${showId}/watched`, { method: "DELETE" }),
    onMutate: async (showId) => {
      await qc.cancelQueries({ queryKey: ["watched-episodes", showId] });
      const snap = snapshotWatched(qc, showId);
      applyWatchedUpdate(qc, snap.key, snap.prev, (s) => s.clear());
      return snap;
    },
    onError: (_err, _showId, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => invalidateAll(qc),
  });
}

/** PUT/DELETE the caller's rating for a show. Pass `null` to clear; otherwise a
 * half-step value in [0.5, 5]. Optimistically updates the cached `["show", id]`
 * detail; reverts on error; invalidates rating-related caches on settle. */
export function useShowRating(showId: number) {
  const qc = useQueryClient();
  return useMutation<Rating | void, Error, number | null, { prev: ShowDetail | undefined }>({
    mutationFn: (stars) => {
      if (stars === null) {
        return apiFetch<void>(`/me/shows/${showId}/rating`, { method: "DELETE" });
      }
      return apiFetch<Rating>(`/me/shows/${showId}/rating`, {
        method: "PUT",
        body: JSON.stringify({ stars }),
      });
    },
    onMutate: async (stars) => {
      await qc.cancelQueries({ queryKey: ["show", showId] });
      const prev = qc.getQueryData<ShowDetail>(["show", showId]);
      if (prev) {
        qc.setQueryData<ShowDetail>(["show", showId], { ...prev, my_rating: stars });
      }
      return { prev };
    },
    onError: (_err, _stars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["show", showId], ctx.prev);
      toast.error("Could not save your rating.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["show", showId] });
      qc.invalidateQueries({ queryKey: ["my-shows"] });
      qc.invalidateQueries({ queryKey: ["shows"] });
    },
  });
}

/** PUT/DELETE the caller's rating for an episode. */
export function useEpisodeRating(episodeId: number) {
  const qc = useQueryClient();
  return useMutation<Rating | void, Error, number | null, { prev: EpisodeOut | undefined }>({
    mutationFn: (stars) => {
      if (stars === null) {
        return apiFetch<void>(`/me/episodes/${episodeId}/rating`, { method: "DELETE" });
      }
      return apiFetch<Rating>(`/me/episodes/${episodeId}/rating`, {
        method: "PUT",
        body: JSON.stringify({ stars }),
      });
    },
    onMutate: async (stars) => {
      await qc.cancelQueries({ queryKey: ["episode", episodeId] });
      const prev = qc.getQueryData<EpisodeOut>(["episode", episodeId]);
      if (prev) {
        qc.setQueryData<EpisodeOut>(["episode", episodeId], { ...prev, my_rating: stars });
      }
      return { prev };
    },
    onError: (_err, _stars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["episode", episodeId], ctx.prev);
      toast.error("Could not save your rating.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["episode", episodeId] });
      const prev = qc.getQueryData<EpisodeOut>(["episode", episodeId]);
      const showId = prev?.show_id;
      if (showId !== undefined) {
        qc.invalidateQueries({ queryKey: ["show-episodes", showId] });
      }
    },
  });
}
