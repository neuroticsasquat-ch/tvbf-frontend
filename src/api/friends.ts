import { apiFetch } from "./client";
import type {
  MyShowEntry,
  MyShowsSort,
  WatchedEntry,
  WatchedSort,
  WatchedStatusFilter,
} from "./types";

export interface FriendShowsOptions {
  sort?: MyShowsSort;
  today?: string;
}

export function getFriendShows(
  userId: string,
  opts: FriendShowsOptions = {},
): Promise<MyShowEntry[]> {
  const params = new URLSearchParams();
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.today) params.set("today", opts.today);
  const qs = params.toString();
  return apiFetch<MyShowEntry[]>(
    `/users/${userId}/shows${qs ? `?${qs}` : ""}`,
  );
}

export interface FriendWatchedOptions {
  status?: WatchedStatusFilter;
  sort?: WatchedSort;
  today?: string;
}

export function getFriendWatched(
  userId: string,
  opts: FriendWatchedOptions = {},
): Promise<WatchedEntry[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.today) params.set("today", opts.today);
  const qs = params.toString();
  return apiFetch<WatchedEntry[]>(
    `/users/${userId}/watched${qs ? `?${qs}` : ""}`,
  );
}
