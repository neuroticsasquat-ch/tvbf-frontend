import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { usePersonSearch } from "@/api/people";
import { useShows } from "@/api/shows";
import type { PersonOut, SortKey } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Pagination } from "@/components/Pagination";
import { PersonChip } from "@/components/PersonChip";
import { ShowGrid } from "@/components/ShowGrid";
import { ShowList } from "@/components/ShowList";
import { ViewToggle } from "@/components/ViewToggle";
import { FilterSheet } from "@/components/home/FilterSheet";
import {
  ClearFiltersButton,
  GenreFilter,
  ShowStatusFilterPicker,
} from "@/components/home/FilterPickers";
import { SHOW_STATUS_KEYS, type ShowStatusFilter } from "@/components/home/filterTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";

const SEARCH_SORTS: { key: SortKey; label: string }[] = [
  { key: "-last_aired", label: "Last Aired" },
  { key: "premiered", label: "Premiered First" },
  { key: "-premiered", label: "Premiered Last" },
  { key: "name", label: "Show Title" },
];
const SEARCH_SORT_KEYS = SEARCH_SORTS.map((s) => s.key);

const STATUS_API_VALUE: Record<ShowStatusFilter, string | undefined> = {
  all: undefined,
  running: "Running",
  ended: "Ended",
  upcoming: "In Development",
  tbd: "To Be Determined",
};

const PER_PAGE = 50;
/** People are a secondary axis of the same search, so the section is deliberately
 * smaller than the show grid — enough to scan, paginated when there's more. */
const PEOPLE_PER_PAGE = 24;
/** One debounce for both queries: a keystroke costs two requests, and firing
 * them on different schedules would make the sections settle at different
 * times for no benefit. The overlay mounts on character one, so the first
 * keystroke has to be debounced along with the rest — hence the empty initial
 * query rather than passing the mounted-with value straight through. */
const DEBOUNCE_MS = 250;

/** "1972–2020", "b. 1972", or nothing — enough to tell two same-named people
 * apart without the full dates the person page prints. */
function personYears(person: PersonOut): string | null {
  const born = person.birthday?.slice(0, 4) ?? null;
  const died = person.deathday?.slice(0, 4) ?? null;
  if (born && died) return `${born}–${died}`;
  if (born) return `b. ${born}`;
  if (died) return `d. ${died}`;
  return null;
}

function personDetail(person: PersonOut): string | null {
  const parts = [person.country_name, personYears(person)].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function SearchSection({
  id,
  title,
  count,
  toolbar,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id={`${id}-heading`} className="text-lg font-semibold">
          {title}
          {count !== undefined && (
            <>
              {" "}
              <span className="font-normal text-muted-foreground">({count})</span>
            </>
          )}
        </h2>
        {toolbar}
      </div>
      {children}
    </section>
  );
}

/** Multi-entity search results: a Shows section and a People section over the
 * same query, each hitting its own endpoint.
 *
 * Two things follow from the sections being independent. Each renders off its
 * own query state, so a slow People response never holds up the show grid. And
 * a section with no results renders nothing at all — the overlay's combined
 * "no results" line appears only once *both* have settled empty.
 *
 * Results are plain links in document order, so Tab walks Shows → People
 * continuously and Enter activates whichever is focused. Roving arrow-key
 * focus is deliberately not used: this is a page of links, not a listbox, and
 * the search box that owns focus while typing needs arrow keys for the caret.
 */
export function SearchOverlay({ search }: { search: string }) {
  const trimmed = search.trim();
  const query = useDebouncedValue(trimmed, DEBOUNCE_MS, "");
  const [view, setView] = usePersistedView("search", "grid");
  const [sort, setSort] = usePersistedSort<SortKey>("search", SEARCH_SORT_KEYS, "-last_aired");
  const [status, setStatus] = usePersistedSort<ShowStatusFilter>(
    "search-status",
    SHOW_STATUS_KEYS,
    "all",
  );
  const [genre, setGenre] = usePersistedString("search-genre", "all");
  const [page, setPage] = useState(1);
  const [peoplePage, setPeoplePage] = useState(1);

  // Reset to page 1 whenever the query or filters change. People paginate
  // independently and none of the show filters apply to them, so only the query
  // resets that section.
  const resetKey = `${query}|${sort}|${status}|${genre}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setPeoplePage(1);
  }

  const enabled = query.length > 0;
  const showsQuery = useShows(
    {
      search: query || undefined,
      status: STATUS_API_VALUE[status],
      genre: genre === "all" ? undefined : [genre],
      sort,
      page,
      per_page: PER_PAGE,
    },
    { enabled },
  );
  const peopleQuery = usePersonSearch(query, {
    page: peoplePage,
    per_page: PEOPLE_PER_PAGE,
    enabled,
  });

  const sortLabel = SEARCH_SORTS.find((s) => s.key === sort)?.label ?? "";
  const filtersActive = status !== "all" || genre !== "all";

  const showsToolbar = (
    <>
      <ShowStatusFilterPicker value={status} onChange={setStatus} />
      <GenreFilter value={genre} onChange={setGenre} />
      {filtersActive && (
        <ClearFiltersButton
          onClear={() => {
            setStatus("all");
            setGenre("all");
          }}
        />
      )}
      <div className="ml-auto flex items-center gap-2">
        <ViewToggle value={view} onChange={setView} ariaLabel="Display" />
        <FilterSheet
          title="Sort"
          triggerLabel={sortLabel}
          triggerIcon={
            <>
              <ArrowDown className="h-4 w-4" aria-hidden />
              <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            </>
          }
          ariaLabel={`Sort results (current: ${sortLabel})`}
          options={SEARCH_SORTS}
          value={sort}
          onChange={setSort}
        />
      </div>
    </>
  );

  function renderShows(): ReactNode {
    const section = (body: ReactNode, count?: number) => (
      <SearchSection id="search-shows" title="Shows" count={count} toolbar={showsToolbar}>
        {body}
      </SearchSection>
    );

    if (showsQuery.isPending) return section(<LoadingState rows={12} />);
    if (showsQuery.isError) {
      return section(
        <ErrorState message={showsQuery.error.message} onRetry={() => showsQuery.refetch()} />,
      );
    }

    const data = showsQuery.data;
    if (data.items.length === 0) {
      // Filters are the one reason to keep an empty Shows section on screen:
      // hiding it would hide the controls that are causing the emptiness.
      if (!filtersActive) return null;
      return section(
        <p className="text-sm text-muted-foreground">No shows match these filters.</p>,
        0,
      );
    }

    return section(
      <>
        {view === "grid" ? <ShowGrid shows={data.items} /> : <ShowList shows={data.items} />}
        <Pagination page={data.page} totalPages={data.total_pages} onPageChange={setPage} />
      </>,
      data.total,
    );
  }

  function renderPeople(): ReactNode {
    // Nothing while pending: most queries match no people at all, and a heading
    // that appears only to vanish reads worse than one that arrives late.
    if (peopleQuery.isPending) return null;
    if (peopleQuery.isError) {
      // A failed request must not look like the (common) no-people case.
      return (
        <SearchSection id="search-people" title="People">
          <ErrorState message={peopleQuery.error.message} onRetry={() => peopleQuery.refetch()} />
        </SearchSection>
      );
    }

    const data = peopleQuery.data;
    if (data.items.length === 0) return null;

    return (
      <SearchSection id="search-people" title="People" count={data.total}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((person) => (
            <li key={person.id}>
              <PersonChip person={person} detail={personDetail(person)} />
            </li>
          ))}
        </ul>
        <Pagination page={data.page} totalPages={data.total_pages} onPageChange={setPeoplePage} />
      </SearchSection>
    );
  }

  const shows = renderShows();
  const people = renderPeople();
  const settled = !showsQuery.isPending && !peopleQuery.isPending;

  return (
    <div className="space-y-8">
      {shows}
      {people}
      {!shows &&
        !people &&
        (settled ? (
          <p className="text-sm text-muted-foreground">No shows or people match "{query}".</p>
        ) : (
          // Both sections are hidden but one is still loading — the shows
          // section only disappears once it has settled empty.
          <LoadingState rows={12} />
        ))}
    </div>
  );
}
