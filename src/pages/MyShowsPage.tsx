import { useState } from "react";
import { Link } from "react-router";
import { useMyShows } from "@/api/me";
import type { MyShowsSort } from "@/api/types";

const SORTS: { key: MyShowsSort; label: string }[] = [
  { key: "recent_activity", label: "Recent activity" },
  { key: "name_asc", label: "Name A→Z" },
  { key: "name_desc", label: "Name Z→A" },
  { key: "added", label: "Recently added" },
];

export function MyShowsPage() {
  const [sort, setSort] = useState<MyShowsSort>("recent_activity");
  const { data, isLoading } = useMyShows(sort);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold">My Shows</h1>
        <label className="text-sm">
          Sort:{" "}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as MyShowsSort)}
            className="rounded border border-border px-2 py-1 bg-background"
            aria-label="Sort My Shows"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isLoading && <p>Loading…</p>}
      {!isLoading && data && data.length === 0 && (
        <p className="text-muted-foreground">Nothing here yet. Add some shows from Browse.</p>
      )}
      {!isLoading && data && data.length > 0 && (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map((entry) => (
            <li key={entry.show.id} className="border border-border rounded p-3">
              <Link to={`/shows/${entry.show.id}`} className="block">
                {entry.show.image_medium && (
                  <img
                    src={entry.show.image_medium}
                    alt=""
                    className="w-full aspect-[2/3] object-cover rounded mb-2"
                  />
                )}
                <h3 className="font-semibold">{entry.show.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {entry.watched_episode_count}/{entry.total_episode_count} watched
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
