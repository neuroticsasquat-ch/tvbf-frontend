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
  rating_average: number | null;
  my_rating: number | null;
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
  rating_average: number | null;
  my_rating: number | null;
}

/** A `ShowSummary` carrying the viewer's library mark — the shape every grid
 * surface serves, mirroring the backend's `MarkedShowOut` one-for-one
 * (tvbf-backend/docs/specs/NEU-1184-in-my-shows-on-browse-surfaces.md §2.1,
 * §5.1).
 *
 * Declared **once** rather than four times. Each surface keeps its own named
 * subtype and its own docstring, because what differs between them is
 * everything *around* the field — different bodies, different `my_rating`
 * rules; what does not differ is the field itself.
 *
 * **Not folded into `ShowSummary`.** That type is nested inside six `/me`
 * payloads (`MyShowEntry.show`, watch-next, upcoming, …) and is `ShowDetail`'s
 * base, none of which the server computes a mark for — a My Shows row's mark is
 * tautologically `true` and the detail page derives membership from
 * `useMyShows()`.
 *
 * `in_my_shows` is a **mark, never a filter**: a tracked show still appears in
 * every list it would otherwise appear in.
 */
export interface MarkedShow extends ShowSummary {
  in_my_shows: boolean;
}

/** One entry of `GET /trending` — `MarkedShow` flattened, which is what makes
 * it an entry rather than a search result.
 *
 * Flattened rather than nested under a `show` key, on `Recommendation`'s
 * reasoning: `ShowGrid` / `ShowCard` already take a `ShowSummary`, so a wrapper
 * type would cost this client something for a single boolean. See
 * tvbf-backend/docs/specs/NEU-1056-trending-contract.md §2.
 *
 * Trending is a claim about the world, and seeing a show you already track in
 * it is a feature.
 */
export interface TrendingShow extends MarkedShow {}

/** The `GET /trending` body.
 *
 * `captured_at` is null exactly when `shows` is empty, and a stale snapshot is
 * served as the same empty body an empty table gives (contract §3). So this
 * client can neither re-derive the seven-day cutoff nor tell the two apart —
 * which is the point: the cutoff is the server's rule, enforced in one place,
 * and a rule enforced in two drifts into week-old rows under a label reading
 * "trending right now".
 */
export interface TrendingSnapshot {
  captured_at: string | null;
  shows: TrendingShow[];
}

/** One entry of `GET /anticipated` — `ShowSummary` flattened, plus the same
 * mark `TrendingShow` carries, and for its reason: `ShowGrid` / `ShowCard`
 * already take a `ShowSummary`, so a wrapper type would cost this client
 * something for one field. See
 * tvbf-backend/docs/specs/NEU-1059-anticipated-contract.md §2.
 *
 * The body is a **bare array**, unlike `/trending`'s object: nothing is
 * stored, so there is no `captured_at` to wrap alongside the list — and for
 * the same reason there is no staleness rule on this surface and nothing here
 * to build one from (contract §3).
 *
 * `premiered` is the field the surface exists for, and it is typed nullable
 * like every other `ShowSummary`'s even though the server never sends an
 * undated show (contract §5) — the card renders "TBA" rather than trusting
 * that.
 *
 * `my_rating` is always null here where `/trending` fills it: every entry
 * premieres in the future, so a rating would be one for something nobody has
 * seen.
 */
export interface AnticipatedShow extends MarkedShow {}

/** One item of `GET /shows` — browse and search results (NEU-1186).
 *
 * The mark is what the search grid was missing: the app knew the show was
 * tracked and declined to say so, on the one surface where "should I add this?"
 * is the actual question (spec §1). `my_rating` was already filled here.
 *
 * The route answers `private, no-store`, and has since before the mark — the
 * body already carried `my_rating`. So adding the mark cost this route no
 * cacheability, and `useShows` keeps its five-minute `staleTime`: invalidation,
 * not `staleTime`, is what keeps the mark fresh (spec §5.2).
 */
export interface BrowseShow extends MarkedShow {}

/** One row of `GET /shows/{id}/similar` — TMDB's "More like this" (NEU-1186).
 *
 * `in_my_shows` **and** `my_rating` are both filled here, and they arrived
 * together: NEU-1053 left the route free of per-user fields to keep a body
 * byte-identical for every viewer, and the mark spends exactly that. Once
 * spent, only the cost of one more query stood against the rating, and leaving
 * it out would have kept the Similar tab as the one grid in the app where the
 * same show shows your stars everywhere else and not here (spec §3.2).
 *
 * `genres` is always `[]` and `network` always null — unchanged from NEU-1053
 * and not re-decided: `ShowCard` renders neither, so hydrating them would be
 * two more round trips for fields nothing displays.
 */
export interface SimilarShow extends MarkedShow {}

export interface Rating {
  stars: number;
  rated_at: string;
}

/** One row of `GET /me/recommendations` — `ShowSummary` flattened, plus the
 * model's own `rank`.
 *
 * Flattened rather than nested under a `show` key, unlike `MyShowEntry` /
 * `WatchNextEntry` / `UpcomingEntry`: those carry per-show progress, which is a
 * second object with its own identity, where a recommendation carries a
 * position. See
 * tvbf-backend/docs/specs/NEU-1112-recommendations-page-contract.md §2.
 *
 * `rank` is the stored rank, so it is not guaranteed contiguous or to start at
 * 1 — a row the server filtered out took its rank with it.
 *
 * **There is no `reason`.** The server stopped serving it on 2026-08-17: the
 * card has one truncated 10px line, which is not room for a sentence. It is
 * still asked for and still stored server-side as a diagnostic, so do not add
 * it back here on the strength of finding it in the database — see the
 * contract's own section on it.
 */
export interface Recommendation extends ShowSummary {
  rank: number;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
}

export interface ShowDetail extends ShowSummary {
  summary: string | null;
  runtime: number | null;
  official_site: string | null;
  externals: ExternalsOut | null;
  tvmaze_updated: number;
  seasons: SeasonOut[];
}

export interface PersonRef {
  id: number;
  name: string;
  image_medium: string | null;
}

export interface CharacterRef {
  id: number;
  name: string;
  image_medium: string | null;
}

export interface CastMember {
  person: PersonRef;
  character: CharacterRef;
  /** Credited as themselves (matches upstream's `self` key). */
  self: boolean;
  voice: boolean;
  /** Episodes this person appeared in as this character, and the key the API
   * orders show cast by (NEU-1039). Optional because it is absent at two
   * grains: the credits routes read `catalog` since NEU-1047 and order show
   * cast by this count, but a show mirrored before the credit writers merged
   * carries none; and episode guest cast is a per-episode row, so it has no
   * count at all. */
  episode_count?: number | null;
}

export interface CrewMember {
  person: PersonRef;
  role: string;
}

/** A person as served by `GET /people/{id}`. Richer than `PersonRef`, which is
 * the compact form embedded in credit payloads. */
export interface PersonOut {
  id: number;
  name: string;
  country_code: string | null;
  country_name: string | null;
  birthday: string | null;
  deathday: string | null;
  gender: string | null;
  image_medium: string | null;
  image_original: string | null;
}

/** Compact show reference embedded in a person's filmography. */
export interface ShowRef {
  id: number;
  name: string;
  image_medium: string | null;
  premiered: string | null;
}

/** Compact episode reference embedded in guest credits. Carries season and
 * number so "Show — S2E11" renders without a second round trip. */
export interface EpisodeRef {
  id: number;
  name: string | null;
  season: number;
  number: number | null;
  airdate: string | null;
}

export interface PersonCastCredit {
  show: ShowRef;
  character: CharacterRef;
  self: boolean;
  voice: boolean;
}

export interface PersonCrewCredit {
  show: ShowRef;
  role: string;
}

export interface PersonGuestCredit {
  show: ShowRef;
  episode: EpisodeRef;
  character: CharacterRef;
  self: boolean;
  voice: boolean;
}

/** A crew credit on one episode — "Director of *Show* S1E3". Distinct from
 * `PersonCrewCredit`, which is show-level: the glossary keeps *crew credit* and
 * *episode crew credit* apart because they answer different questions, and the
 * vocabularies are disjoint (Director/Writer/Story/Teleplay here, production
 * functions like Executive Producer there). */
export interface PersonEpisodeCrewCredit {
  show: ShowRef;
  episode: EpisodeRef;
  role: string;
}

/** Grouped filmography from `GET /people/{id}/credits`. All four keys are
 * always present — an absent category is an empty array, never a missing key. */
export interface PersonCredits {
  cast: PersonCastCredit[];
  crew: PersonCrewCredit[];
  guest_cast: PersonGuestCredit[];
  episode_crew: PersonEpisodeCrewCredit[];
}

/** A page of person search results. Items are full `PersonOut` rows, not a
 * compact form — a person row is small, so search results render everything the
 * person page header shows without a second fetch. */
export interface PersonListPage {
  items: PersonOut[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ShowListPage {
  items: BrowseShow[];
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
  /** **The row owner's rating, not the requester's** (NEU-1191). The two are
   * the same user on `GET /me/watched` and differ on `GET /users/{id}/watched`,
   * where the value is the *friend's* rating and is null when the friend has
   * not rated a show however the caller rated it. `MyShowEntry.my_rating`
   * behaves identically, and both are attributed through `ratingOwnerFor`
   * (NEU-1181) rather than assumed to be the viewer's.
   *
   * It is top-level rather than on `show`, because `ShowSummary.my_rating`
   * means the *requester's* rating everywhere it is filled. */
  my_rating: number | null;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  email_verified_at: string | null;
}

export interface AuthedUser extends User {
  csrf_token: string;
  activity_feed_enabled: boolean;
  is_admin: boolean;
}

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  is_admin: boolean;
}

export interface InviteRow {
  code: string;
  email_hint: string | null;
  created_at: string;
  consumed_at: string | null;
  consumed_by_user_id: string | null;
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
  // The caller's own rating for this show. Hydrated by the /me/shows endpoint
  // alongside `show: ShowSummary` (where `my_rating` stays null because the
  // ShowSummary builder used inside my_shows_service doesn't carry it).
  my_rating: number | null;
  hide_from_activity?: boolean;
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

export interface UpcomingSeasonEntry {
  show: ShowSummary;
  season_number: number;
  season_name: string | null;
  premiere_date: string | null;
  added_at: string | null;
}

export interface UpcomingShowEntry {
  show: ShowSummary;
  premiere_date: string | null;
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

export interface FriendRating {
  user_id: string;
  display_name: string;
  stars: number;
  rated_at: string;
}

export interface FriendRatingsResponse {
  avg: number | null;
  count: number;
  items: FriendRating[];
}

export type FeedKind =
  | "added_show"
  | "watched_episode"
  | "watched_episode_run"
  | "watched_season"
  | "watched_show"
  | "rated_show"
  | "rated_episode";

export interface FeedShowMini {
  id: number;
  name: string;
}

export interface FeedEpisodeMini {
  id: number;
  name: string | null;
  season: number;
  /** Null for a copied TV Maze special, which has no real episode number
   * (NEU-1062). `FeedItemRow` drops the `E` segment rather than inventing one,
   * and puts `name` in its place so one special is still tellable from another
   * (NEU-1134). */
  number: number | null;
}

export interface FeedItem {
  id: string;
  actor: UserBrief;
  kind: FeedKind;
  show: FeedShowMini | null;
  episode: FeedEpisodeMini | null;
  season_number: number | null;
  /** The season's own name, paired with `season_number` and set only for a
   * `watched_season` roll-up (NEU-1132). Null wherever `season_number` is, and
   * null when upstream never named the season — `seasonLabel` falls back to the
   * number for both. */
  season_name: string | null;
  rollup_count: number | null;
  stars: number | null;
  occurred_at: string;
}

export interface FeedPage {
  items: FeedItem[];
  next_cursor: string | null;
}
