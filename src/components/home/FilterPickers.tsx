import { useEffect } from "react";
import { BookmarkCheck, Eye, Star, Tv, Tag, X } from "lucide-react";
import { useGenres } from "@/api/shows";
import { FilterSheet } from "@/components/home/FilterSheet";
import {
  IN_MY_SHOWS_FILTERS,
  RATED_FILTER_KEYS,
  SHOW_STATUSES,
  WATCH_STATES,
  type InMyShowsFilter,
  type RatedFilter,
  type ShowStatusFilter,
  type WatchState,
  genreOptions,
} from "@/components/home/filterTypes";

const ICON_CLS = "h-4 w-4 text-muted-foreground";

/** Visual separator between user-relative and show-relative filter groups. */
export function FilterGroupDivider() {
  return <span aria-hidden className="w-px h-5 bg-border mx-0.5 shrink-0 self-center" />;
}

export function ClearFiltersButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="text-sm rounded px-2 py-1 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-accent"
    >
      <X className="h-4 w-4" aria-hidden />
      <span>Clear filters</span>
    </button>
  );
}

export function WatchStateFilter({
  value,
  onChange,
  options = WATCH_STATES,
  disabledOptions,
}: {
  value: WatchState;
  onChange: (next: WatchState) => void;
  options?: readonly { key: WatchState; label: string }[];
  /** Map of option keys to disabled-reason tooltips. Disabled options render
   * greyed out and unclickable. */
  disabledOptions?: Partial<Record<WatchState, string>>;
}) {
  const label = options.find((s) => s.key === value)?.label ?? "";
  const optionsWithDisabled = options.map((o) => ({
    ...o,
    disabledReason: disabledOptions?.[o.key],
  }));
  return (
    <FilterSheet
      title="Watch state"
      triggerLabel={`Watching: ${label}`}
      triggerIcon={<Eye className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by watch state (current: ${label})`}
      options={optionsWithDisabled}
      value={value}
      onChange={onChange}
      active={value !== "all"}
    />
  );
}

export function InMyShowsFilterPicker({
  value,
  onChange,
  disabledOptions,
  disabledReason,
}: {
  value: InMyShowsFilter;
  onChange: (next: InMyShowsFilter) => void;
  disabledOptions?: Partial<Record<InMyShowsFilter, string>>;
  /** When set, the entire picker is disabled with this tooltip — used on
   * Active tabs where every row is in My Shows by definition. */
  disabledReason?: string;
}) {
  const label = IN_MY_SHOWS_FILTERS.find((o) => o.key === value)?.label ?? "All";
  const options = IN_MY_SHOWS_FILTERS.map((o) => ({
    ...o,
    disabledReason: disabledOptions?.[o.key],
  }));
  return (
    <FilterSheet
      title="My Shows membership"
      triggerLabel={`My Shows: ${label}`}
      triggerIcon={<BookmarkCheck className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by My Shows membership (current: ${label})`}
      options={options}
      value={value}
      onChange={onChange}
      active={value !== "all"}
      disabledReason={disabledReason}
    />
  );
}

/** Friend-relative watch-state filter. Uses "Their Watching" to contrast with
 * the viewer's own "My Watch State" filter below. */
export function TheirWatchingFilter({
  value,
  onChange,
}: {
  value: WatchState;
  onChange: (next: WatchState) => void;
}) {
  const label = WATCH_STATES.find((s) => s.key === value)?.label ?? "";
  return (
    <FilterSheet
      title="Their Watching"
      triggerLabel={`Their Watching: ${label}`}
      triggerIcon={<Eye className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by their watch state (current: ${label})`}
      options={WATCH_STATES}
      value={value}
      onChange={onChange}
      active={value !== "all"}
    />
  );
}

/** Friend-relative My Shows membership filter. Uses "Their Shows" so "My Shows"
 * is reserved for the viewing user's own library. */
const THEIR_SHOWS_OPTIONS: { key: InMyShowsFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in", label: "In my My Shows" },
  { key: "not_in", label: "Not in my My Shows" },
];

export function TheirShowsFilterPicker({
  value,
  onChange,
}: {
  value: InMyShowsFilter;
  onChange: (next: InMyShowsFilter) => void;
}) {
  const label = THEIR_SHOWS_OPTIONS.find((o) => o.key === value)?.label ?? "All";
  return (
    <FilterSheet
      title="Their Shows"
      triggerLabel={`Their Shows: ${label}`}
      triggerIcon={<BookmarkCheck className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by their My Shows membership (current: ${label})`}
      options={THEIR_SHOWS_OPTIONS}
      value={value}
      onChange={onChange}
      active={value !== "all"}
    />
  );
}

/** Viewer-relative watch-state filter for friend library tabs. Mirrors
 * `TheirWatchingFilter` but targets the viewer's own progress, styled as
 * "My Watch State" to match the viewer's perspective. */
export function MyWatchStateFilter({
  value,
  onChange,
}: {
  value: WatchState;
  onChange: (next: WatchState) => void;
}) {
  const label = WATCH_STATES.find((s) => s.key === value)?.label ?? "";
  return (
    <FilterSheet
      title="My Watch State"
      triggerLabel={`My Watch State: ${label}`}
      triggerIcon={<Eye className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by my watch state (current: ${label})`}
      options={WATCH_STATES}
      value={value}
      onChange={onChange}
      active={value !== "all"}
    />
  );
}

export function ShowStatusFilterPicker({
  value,
  onChange,
}: {
  value: ShowStatusFilter;
  onChange: (next: ShowStatusFilter) => void;
}) {
  const label = SHOW_STATUSES.find((s) => s.key === value)?.label ?? "";
  return (
    <FilterSheet
      title="Show status"
      triggerLabel={`Status: ${label}`}
      triggerIcon={<Tv className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by show status (current: ${label})`}
      options={SHOW_STATUSES}
      value={value}
      onChange={onChange}
      active={value !== "all"}
    />
  );
}

const RATED_FILTER_OPTIONS: { key: RatedFilter; label: string }[] = RATED_FILTER_KEYS.map((k) => ({
  key: k,
  label: k === "all" ? "All" : "Rated only",
}));

export function RatedOnlyFilter({
  value,
  onChange,
}: {
  value: RatedFilter;
  onChange: (next: RatedFilter) => void;
}) {
  const label = RATED_FILTER_OPTIONS.find((o) => o.key === value)?.label ?? "All";
  return (
    <FilterSheet
      title="My ratings"
      triggerLabel={`Rated: ${label}`}
      triggerIcon={<Star className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by my ratings (current: ${label})`}
      options={RATED_FILTER_OPTIONS}
      value={value}
      onChange={onChange}
      active={value !== "all"}
    />
  );
}

export function GenreFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { data } = useGenres();
  const options = genreOptions(data);
  const label = options.find((o) => o.key === value)?.label ?? "All";

  // The genre filter is persisted with `usePersistedString`, which — unlike
  // `usePersistedSort` — validates nothing: a stored value is restored
  // verbatim and filters every list to empty while the picker still reads as a
  // valid choice (NEU-1031 D3). The genre vocabulary is not static (TMDB's 16
  // replace TV Maze's 28 at cutover, sharing 7), so the check has to be
  // against the list the API actually served rather than a constant. `data`
  // being undefined means "not loaded yet", not "not a genre" — hence the
  // guard, without which every mount would clear the filter before the genres
  // arrive.
  useEffect(() => {
    if (!data) return;
    if (value !== "all" && !data.some((g) => g.name === value)) onChange("all");
  }, [data, value, onChange]);

  return (
    <FilterSheet
      title="Genre"
      triggerLabel={`Genre: ${label}`}
      triggerIcon={<Tag className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by genre (current: ${label})`}
      options={options}
      value={value}
      onChange={onChange}
      active={value !== "all"}
    />
  );
}
