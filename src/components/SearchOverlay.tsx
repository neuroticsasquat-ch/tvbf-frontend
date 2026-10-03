import { useEffect, useState, type ReactNode } from "react";

import { usePersonSearch } from "@/api/people";
import { useShows } from "@/api/shows";
import type { PersonOut, SortKey } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Pagination } from "@/components/Pagination";
import { PersonChip } from "@/components/PersonChip";
import { ShowGrid } from "@/components/ShowGrid";
import { ShowList } from "@/components/ShowList";
import { ListingToolbar } from "@/components/home/ListingToolbar";
import {
  ClearFiltersButton,
  GenreFilter,
  ShowStatusFilterPicker,
} from "@/components/home/FilterPickers";
import {
  SHOW_STATUS_API_VALUE,
  SHOW_STATUS_KEYS,
  type ShowStatusFilter,
} from "@/components/home/filterTypes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";

// Popularity is TMDB's score, and first because it is the default (NEU-1513).
// Labelled "Popularity", never "Popular": the glossary reserves that word for
// the friend-scoped list. No ascending option — nobody wants the least-known
// match first.
const SEARCH_SORTS: { key: SortKey; label: string }[] = [
  { key: "-popularity", label: "Popularity" },
  { key: "-last_aired", label: "Last Aired" },
  { key: "premiered", label: "Premiered First" },
  { key: "-premiered", label: "Premiered Last" },
  { key: "name", label: "Show Title" },
];
const SEARCH_SORT_KEYS = SEARCH_SORTS.map((s) => s.key);

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
      {/* The heading stands alone and the controls sit below it, in the one
        order every listing page uses (NEU-1189 AC 1). They used to share this
        row, with the filters inline beside the `h2` and the view toggle and
        sort pushed to the far right by `ml-auto` — the only right-aligned
        toolbar in the app. */}
      <h2 id={`${id}-heading`} className="mb-3 text-lg font-semibold">
        {title}
        {count !== undefined && (
          <>
            {" "}
            <span className="font-normal text-muted-foreground">({count})</span>
          </>
        )}
      </h2>
      {toolbar}
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
 *
 * Both queries keep their previous results as placeholder data, so a new query
 * swaps the grid in place instead of flashing it to skeletons — skeletons are
 * for the first query of a session only. What says "these are stale" is the
 * search box's spinner, fed by `onBusyChange` (NEU-1502).
 */
export function SearchOverlay({
  search,
  onBusyChange,
}: {
  search: string;
  /** Called with whether a search is running: from the keystroke that changes
   * the query until both sections have settled for it. `false` on unmount. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const trimmed = search.trim();
  const query = useDebouncedValue(trimmed, DEBOUNCE_MS, "");
  const [view, setView] = usePersistedView("search", "grid");
  // The page key was renamed from "search" when the default moved to
  // Popularity (NEU-1513): a stored `-last_aired` cannot be told apart from the
  // old default, so a fresh key is what lands every viewer on the new one once.
  const [sort, setSort] = usePersistedSort<SortKey>(
    "search-sort-v2",
    SEARCH_SORT_KEYS,
    "-popularity",
  );
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
      status: SHOW_STATUS_API_VALUE[status],
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

  // "Searching", as the viewer means it (NEU-1502 §3.1). The first term is the
  // debounce window, which would otherwise be a silent 250 ms after every
  // keystroke. Placeholder data is an older key's answer still on screen.
  // Deliberately not `isFetching`: that is also true while an add/remove from
  // a card refetches the same key (NEU-1192), when nothing typed is running.
  const busy =
    trimmed !== query ||
    showsQuery.isPending ||
    showsQuery.isPlaceholderData ||
    peopleQuery.isPending ||
    peopleQuery.isPlaceholderData;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  // The overlay unmounts when the input empties; the spinner must not outlive it.
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const filtersActive = status !== "all" || genre !== "all";

  const showsToolbar = (
    <ListingToolbar
      view={{ value: view, onChange: setView, ariaLabel: "Shows display" }}
      sort={{ label: "Shows", options: SEARCH_SORTS, value: sort, onChange: setSort }}
      filters={
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
        </>
      }
    />
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
        {/* `addable` on both views, never one (NEU-1192): search is the one
            surface where "should I add this?" is the question being asked, and
            a control present in only one view would reintroduce the parity
            defect NEU-1188 exists to remove. `data.items` is `BrowseShow[]`,
            so the chip and the mark are fed from one field on one object. */}
        {view === "grid" ? (
          <ShowGrid shows={data.items} addable />
        ) : (
          <ShowList shows={data.items} addable />
        )}
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
  // A placeholder is an older query's answer, so it cannot settle this one:
  // without that, the combined "no match" line could flash for the new query
  // while the old grid is still what the viewer is looking at.
  const settled =
    !showsQuery.isPending &&
    !showsQuery.isPlaceholderData &&
    !peopleQuery.isPending &&
    !peopleQuery.isPlaceholderData;

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
