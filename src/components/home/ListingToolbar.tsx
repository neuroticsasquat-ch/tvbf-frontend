import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { ViewToggle, type ViewMode } from "@/components/ViewToggle";
import { FilterSheet } from "@/components/home/FilterSheet";

type SortOption<T extends string> = {
  key: T;
  label: string;
  /** Rendered greyed out and unclickable, with the value as a tooltip. */
  disabledReason?: string;
};

/** The controls above a listing page's results, in **one fixed order: view
 * toggle, then sort, then filters** — left-aligned, on every listing page
 * (NEU-1189 AC 1).
 *
 * Before this there were four layouts across five sibling pages: My Shows put
 * view and sort on a left-aligned row, Search hung filters off the section
 * heading and pushed view and sort to the right with `ml-auto`, Watch Next
 * attached its sort to the `h1` with `justify-between`, and Upcoming's three
 * tabs left the sort alone on a row of its own. The eye had to re-find the
 * controls per tab.
 *
 * **Order and alignment are not passed in.** They are the whole point of the
 * component, exactly as corner placement is `ShowPoster`'s (NEU-1183 §5.1): a
 * shared class string is what drifted, so a new listing page gets the right
 * layout by using this and stating no position at all.
 *
 * **The view toggle is a value, the filters are a node** — the same split
 * `ShowPoster` draws between facts and controls. `view` is `{value, onChange}`
 * so this component builds the toggle itself; `filters` stays a `ReactNode`
 * because filter pickers genuinely vary per surface. Sort sits with the view
 * toggle rather than the filters because it orders results, it does not remove
 * any — and it is built here from `label` and `options` so the trigger's arrows
 * and its `Sort X (current: Y)` accessible name cannot drift between pages
 * either.
 *
 * **Omitting `view` is a decision, not an oversight** (AC 4). Watch Next and
 * Upcoming deliberately offer no view toggle: a grid cell is ~109px wide at
 * 375px, which cannot carry `S3E4`, the episode title and an airdate, so a grid
 * view of an episode row could not hold the facts its list view holds — and
 * NEU-1188 has just made carrying the same facts in both views the rule. A
 * toggle whose grid half is a worse list is not a missing feature. My Shows and
 * Search pass `view` because their rows are shows, which a poster grid renders
 * whole.
 */
export function ListingToolbar<T extends string>({
  view,
  sort,
  filters,
}: {
  /** Omit on a page that deliberately has no grid view — see above. */
  view?: { value: ViewMode; onChange: (next: ViewMode) => void; ariaLabel: string };
  sort: {
    /** Names the surface: `"Watch Next"` gives a `Sort Watch Next` sheet and a
     * `Sort Watch Next (current: Next Air Date)` trigger. One label so the two
     * cannot disagree. */
    label: string;
    options: readonly SortOption<T>[];
    value: T;
    onChange: (next: T) => void;
  };
  filters?: ReactNode;
}) {
  const current = sort.options.find((o) => o.key === sort.value)?.label ?? "";
  return (
    <>
      <div
        // The tripwire that stops a sixth listing page hand-rolling a toolbar:
        // each page's own test asserts it renders through this component rather
        // than restating the order rule (`ShowPoster` installs the same one).
        data-listing-toolbar=""
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {view && (
          <ViewToggle value={view.value} onChange={view.onChange} ariaLabel={view.ariaLabel} />
        )}
        <FilterSheet
          title={`Sort ${sort.label}`}
          triggerLabel={current}
          triggerIcon={
            <>
              <ArrowDown className="h-4 w-4" aria-hidden />
              <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            </>
          }
          ariaLabel={`Sort ${sort.label} (current: ${current})`}
          options={sort.options}
          value={sort.value}
          onChange={sort.onChange}
        />
      </div>
      {/* `flex-wrap` on both rows is what keeps AC 5 true: at 375px the filter
        pickers wrap onto further lines rather than widening the page. */}
      {filters && <div className="mb-4 flex flex-wrap items-center gap-2">{filters}</div>}
    </>
  );
}
