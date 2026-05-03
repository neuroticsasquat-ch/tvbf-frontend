import { Eye, Tv, Tag, X } from "lucide-react";
import { useGenres } from "@/api/shows";
import { FilterSheet } from "@/components/home/FilterSheet";
import {
  SHOW_STATUSES,
  WATCH_STATES,
  type ShowStatusFilter,
  type WatchState,
  genreOptions,
} from "@/components/home/filterTypes";

const ICON_CLS = "h-4 w-4 text-muted-foreground";

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
}: {
  value: WatchState;
  onChange: (next: WatchState) => void;
  options?: readonly { key: WatchState; label: string }[];
}) {
  const label = options.find((s) => s.key === value)?.label ?? "";
  return (
    <FilterSheet
      title="Watch state"
      triggerLabel={`Watching: ${label}`}
      triggerIcon={<Eye className={ICON_CLS} aria-hidden />}
      ariaLabel={`Filter by watch state (current: ${label})`}
      options={options}
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
