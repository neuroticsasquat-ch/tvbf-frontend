import { Link } from "react-router";
import { Check } from "lucide-react";
import type { MyShowEntry } from "@/api/types";
import { RatingBadge } from "@/components/RatingBadge";
import { WatchProgressBar } from "@/components/WatchProgressBar";

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'><rect width='3' height='4' fill='%23e2e8f0'/></svg>";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

export function MyShowCard({
  entry,
  inMyShows = true,
}: {
  entry: MyShowEntry;
  /** Whether this show is in the user's My Shows. On the Active tab every
   * card is in My Shows by definition; on All Watched it varies per row. */
  inMyShows?: boolean;
}) {
  // Same predicate as the list view (NEU-101 decision 2): show is over AND
  // the user is fully caught up.
  const isFinished =
    entry.aired_episode_count > 0 &&
    entry.watched_episode_count >= entry.aired_episode_count &&
    (entry.show.status ?? "") === "Ended";

  return (
    <Link
      to={`/shows/${entry.show.id}`}
      className="group relative block overflow-hidden rounded border border-border bg-background transition hover:border-foreground"
    >
      <div className="relative">
        <img
          src={entry.show.image_medium ?? FALLBACK_POSTER}
          alt=""
          className="aspect-[210/295] w-full object-cover"
          loading="lazy"
        />
        {inMyShows && (
          <span
            className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow"
            title="In My Shows"
            aria-label="In My Shows"
          >
            <Check className="h-3.5 w-3.5" aria-hidden strokeWidth={3} />
          </span>
        )}
        {entry.my_rating != null && entry.my_rating > 0 && (
          <RatingBadge
            value={entry.my_rating}
            title="Your rating"
            className="absolute bottom-1 left-1 text-[10px] py-0 px-1 shadow"
          />
        )}
      </div>
      <div className="p-1.5">
        <h3 className="truncate text-xs font-medium leading-tight group-hover:underline">
          {entry.show.name}
        </h3>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {year(entry.show.premiered)}
        </p>
        {isFinished ? (
          <span className="mt-1 inline-block text-[10px] px-1 py-0.5 rounded border border-emerald-600 text-emerald-700">
            Finished
          </span>
        ) : (
          <>
            {entry.aired_episode_count > 0 && (
              <WatchProgressBar
                watched={entry.watched_episode_count}
                aired={entry.aired_episode_count}
                upcoming={entry.upcoming_episode_count}
                barOnly
              />
            )}
            {entry.aired_episode_count > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                Progress: {entry.watched_episode_count}/{entry.aired_episode_count}
              </p>
            )}
            {entry.upcoming_episode_count > 0 && (
              <p className="text-[10px] text-muted-foreground leading-tight">
                {entry.upcoming_episode_count} upcoming
              </p>
            )}
          </>
        )}
      </div>
    </Link>
  );
}
