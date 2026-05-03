import { Link } from "react-router";
import type { ShowSummary } from "@/api/types";

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'><rect width='3' height='4' fill='%23e2e8f0'/></svg>";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

export function ShowList({ shows }: { shows: ShowSummary[] }) {
  if (shows.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">No shows match your filters.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {shows.map((show) => (
        <li key={show.id}>
          <Link
            to={`/shows/${show.id}`}
            className="border border-border rounded p-3 flex items-center gap-4 hover:bg-accent"
          >
            <img
              src={show.image_medium ?? FALLBACK_POSTER}
              alt=""
              className="w-16 aspect-[210/295] object-cover rounded"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg mb-1">
                {show.name}
                <span className="font-normal text-muted-foreground"> ({year(show.premiered)})</span>
              </p>
              <p className="text-xs text-muted-foreground leading-tight">
                {[show.network?.name, show.status, show.language]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {show.genres.length > 0 && (
                <p className="text-xs text-muted-foreground leading-tight">
                  {show.genres.join(", ")}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
