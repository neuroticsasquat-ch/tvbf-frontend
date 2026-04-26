import { useState } from "react";
import { Link } from "react-router";
import { useUpcoming } from "@/api/me";
import type { UpcomingSort } from "@/api/types";

const SORTS: { key: UpcomingSort; label: string }[] = [
  { key: "airdate_asc", label: "Soonest first" },
  { key: "airdate_desc", label: "Furthest out first" },
  { key: "name_asc", label: "Name A→Z" },
  { key: "name_desc", label: "Name Z→A" },
];

export function UpcomingPage() {
  const [sort, setSort] = useState<UpcomingSort>("airdate_asc");
  const { data, isLoading } = useUpcoming(sort);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold">Upcoming</h1>
        <label className="text-sm">
          Sort:{" "}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as UpcomingSort)}
            className="rounded border border-border px-2 py-1 bg-background"
            aria-label="Sort Upcoming"
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
        <p className="text-muted-foreground">No upcoming episodes scheduled for your shows.</p>
      )}
      {!isLoading && data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((entry) => (
            <li
              key={entry.show.id}
              className="border border-border rounded p-3 flex items-center gap-4"
            >
              {entry.show.image_medium && (
                <img
                  src={entry.show.image_medium}
                  alt=""
                  className="w-16 aspect-[2/3] object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <Link
                  to={`/shows/${entry.show.id}`}
                  className="font-semibold hover:underline"
                >
                  {entry.show.name}
                </Link>
                <p className="text-sm">
                  S{entry.episode.season}E{entry.episode.number}
                  {entry.episode.name ? ` — ${entry.episode.name}` : ""}
                </p>
                {entry.episode.airdate && (
                  <p className="text-xs text-muted-foreground">Airs {entry.episode.airdate}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
