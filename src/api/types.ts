export type SortKey =
  | "name"
  | "-name"
  | "premiered"
  | "-premiered"
  | "tvmaze_updated"
  | "-tvmaze_updated"
  | "last_aired"
  | "-last_aired";

export const ALL_SORT_KEYS: readonly SortKey[] = [
  "name",
  "-name",
  "premiered",
  "-premiered",
  "tvmaze_updated",
  "-tvmaze_updated",
  "last_aired",
  "-last_aired",
] as const;

export interface NetworkRef {
  id: number;
  name: string;
}

export interface NetworkOut {
  id: number;
  name: string;
  country_code: string | null;
  country_name: string | null;
  timezone: string | null;
}

export interface GenreOut {
  id: number;
  name: string;
}

export interface ExternalsOut {
  imdb: string | null;
  tvdb: number | null;
  tvrage: number | null;
}

export interface SeasonOut {
  id: number;
  number: number;
  name: string | null;
  episode_order: number | null;
  premiere_date: string | null;
  end_date: string | null;
  network: NetworkRef | null;
  web_channel: NetworkRef | null;
  image_medium: string | null;
  image_original: string | null;
  summary: string | null;
}

export interface EpisodeOut {
  id: number;
  show_id: number;
  season_id: number | null;
  season: number;
  number: number | null;
  name: string | null;
  airdate: string | null;
  airtime: string | null;
  runtime: number | null;
  summary: string | null;
  image_medium: string | null;
  image_original: string | null;
  // Per-user watched flag. Populated by `/me/*` list endpoints; null on
  // catalog-browse endpoints that have no user context.
  watched: boolean | null;
}

export interface ShowSummary {
  id: number;
  name: string;
  type: string | null;
  status: string | null;
  language: string | null;
  premiered: string | null;
  ended: string | null;
  image_medium: string | null;
  image_original: string | null;
  network: NetworkRef | null;
  web_channel: NetworkRef | null;
  genres: string[];
  matched_aka: string | null;
}

export interface ShowDetail extends ShowSummary {
  summary: string | null;
  runtime: number | null;
  official_site: string | null;
  externals: ExternalsOut | null;
  tvmaze_updated: number;
  seasons: SeasonOut[];
}

export interface ShowListPage {
  items: ShowSummary[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ShowFilters {
  search?: string;
  status?: string;
  genre?: string[];
  network?: number[];
  language?: string;
  type?: string;
  sort?: SortKey;
  page?: number;
  per_page?: number;
}

export type MyShowsSort = "recent_activity" | "name_asc" | "name_desc" | "added";
export type WatchNextSort =
  | "last_aired_desc"
  | "last_watched_desc"
  | "oldest_unwatched_asc"
  | "newest_unwatched_desc"
  | "added_desc"
  | "name_asc";
export type UpcomingSort = "airdate_asc" | "airdate_desc" | "added_desc" | "name_asc" | "name_desc";
export type WatchedSort =
  | "name_asc"
  | "last_watched_desc"
  | "last_aired_desc"
  | "premiered_asc"
  | "premiered_desc"
  | "first_watched_desc";
export type WatchedStatusFilter = "all" | "finished" | "in_progress";
export type WatchedStatus = "finished" | "in_progress";

export interface WatchedEntry {
  show: ShowSummary;
  watched_episode_count: number;
  aired_episode_count: number;
  total_episode_count: number;
  last_watched_at: string | null;
  last_aired: string | null;
  first_watched_at: string | null;
  in_my_shows: boolean;
  status: WatchedStatus;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthedUser extends User {
  csrf_token: string;
}

export interface MyShowEntry {
  show: ShowSummary;
  watched_episode_count: number;
  total_episode_count: number;
  aired_episode_count: number;
  upcoming_episode_count: number;
  last_aired: string | null;
  last_watched_at: string | null;
  first_watched_at: string | null;
  next_episode: EpisodeOut | null;
  added_at: string;
}

export interface WatchNextEntry {
  show: ShowSummary;
  episode: EpisodeOut;
  last_watched_at: string | null;
  last_aired: string | null;
  watched_episode_count: number;
  aired_episode_count: number;
  upcoming_episode_count: number;
  added_at: string | null;
}

export interface UpcomingEntry {
  show: ShowSummary;
  episode: EpisodeOut;
  watched_episode_count: number;
  aired_episode_count: number;
  upcoming_episode_count: number;
  added_at: string | null;
}

export interface EpisodeWatchOut {
  episode_id: number;
  watched_at: string;
}

export interface UserBrief {
  id: string;
  display_name: string;
}

export interface UserSearchResult {
  id: string;
  display_name: string;
}

export type ConnectionState = "pending" | "accepted" | "blocked";

export interface ConnectionRequestOut {
  id: string;
  requester: UserBrief;
  addressee: UserBrief;
  state: ConnectionState;
  created_at: string;
  responded_at: string | null;
}

export interface ConnectionRequestList {
  incoming: ConnectionRequestOut[];
  outgoing: ConnectionRequestOut[];
}

export interface ConnectionOut {
  user: UserBrief;
  since: string;
}

export interface BlockedUserOut {
  user: UserBrief;
  blocked_at: string;
}

export interface ShowFriendActivity {
  in_my_shows: UserBrief[];
  watched: UserBrief[];
}
