import { Link } from "react-router";
import type { MyShowEntry } from "@/api/types";
import { WatchProgressBar } from "@/components/WatchProgressBar";

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'><rect width='3' height='4' fill='%23e2e8f0'/></svg>";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

export function MyShowCard({ entry }: { entry: MyShowEntry }) {
  return (
    <Link
      to={`/shows/${entry.show.id}`}
      className="group block overflow-hidden rounded border border-border bg-background transition hover:border-foreground"
    >
      <img
        src={entry.show.image_medium ?? FALLBACK_POSTER}
        alt=""
        className="aspect-[3/4] w-full object-cover"
        loading="lazy"
      />
      <div className="p-1.5">
        <h3 className="truncate text-xs font-medium leading-tight group-hover:underline">
          {entry.show.name}
        </h3>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {year(entry.show.premiered)}
        </p>
        <WatchProgressBar
          watched={entry.watched_episode_count}
          aired={entry.aired_episode_count}
          upcoming={entry.upcoming_episode_count}
        />
      </div>
    </Link>
  );
}
