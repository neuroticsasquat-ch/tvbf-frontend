export type SortKey =
  | "name"
  | "-name"
  | "premiered"
  | "-premiered"
  | "tvmaze_updated"
  | "-tvmaze_updated";

export const ALL_SORT_KEYS: readonly SortKey[] = [
  "name",
  "-name",
  "premiered",
  "-premiered",
  "tvmaze_updated",
  "-tvmaze_updated",
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
  | "last_watched_desc"
  | "last_aired_desc"
  | "name_asc";
export type UpcomingSort = "airdate_asc" | "airdate_desc" | "name_asc" | "name_desc";

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
}

export interface UpcomingEntry {
  show: ShowSummary;
  episode: EpisodeOut;
  watched_episode_count: number;
  aired_episode_count: number;
  upcoming_episode_count: number;
}

export interface EpisodeWatchOut {
  episode_id: number;
  watched_at: string;
}
