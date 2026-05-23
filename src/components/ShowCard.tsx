import { Link } from "react-router";

import type { ShowSummary } from "@/api/types";
import { RatingBadge } from "@/components/RatingBadge";
import { tvmazeToFiveStar } from "@/lib/rating";

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'><rect width='3' height='4' fill='%23e2e8f0'/></svg>";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

export function ShowCard({ show }: { show: ShowSummary }) {
  const aggregate = tvmazeToFiveStar(show.rating_average);
  return (
    <Link
      to={`/shows/${show.id}`}
      className="group relative block overflow-hidden rounded border border-border bg-background transition hover:border-foreground"
    >
      <img
        src={show.image_medium ?? FALLBACK_POSTER}
        alt=""
        className="aspect-[210/295] w-full object-cover"
        loading="lazy"
      />
      {show.my_rating != null && show.my_rating > 0 && (
        <RatingBadge
          value={show.my_rating}
          title="Your rating"
          className="absolute top-1 right-1 text-[10px] py-0 px-1 shadow"
        />
      )}
      <div className="p-1.5">
        <div className="flex items-baseline gap-1">
          <h3 className="truncate text-xs font-medium leading-tight group-hover:underline">
            {show.name}
          </h3>
          {aggregate != null && (
            <RatingBadge
              value={aggregate}
              title="TV Maze average"
              className="shrink-0 text-[10px] py-0 px-1"
            />
          )}
        </div>
        {show.matched_aka && (
          <p className="truncate text-[10px] text-muted-foreground leading-tight italic">
            {show.matched_aka}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground leading-tight">{year(show.premiered)}</p>
      </div>
    </Link>
  );
}
