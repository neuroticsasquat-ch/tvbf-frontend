import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import type { ShowSummary } from "@/api/types";

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'><rect width='3' height='4' fill='%23e2e8f0'/></svg>";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

export function ShowCard({ show }: { show: ShowSummary }) {
  return (
    <Link
      to={`/shows/${show.id}`}
      className="group block overflow-hidden rounded border border-border bg-background transition hover:border-foreground"
    >
      <img
        src={show.image_medium ?? FALLBACK_POSTER}
        alt=""
        className="aspect-[3/4] w-full object-cover"
        loading="lazy"
      />
      <div className="p-3">
        <h3 className="truncate text-sm font-medium group-hover:underline">{show.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {year(show.premiered)} {show.network?.name ? `· ${show.network.name}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {show.genres.slice(0, 3).map((g) => (
            <Badge key={g} variant="secondary" className="text-[10px]">
              {g}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
