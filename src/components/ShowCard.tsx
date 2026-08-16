import { Library } from "lucide-react";
import { Link } from "react-router";

import type { ShowSummary } from "@/api/types";
import { RatingBadge } from "@/components/RatingBadge";
import { tenPointToFiveStar } from "@/lib/rating";

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'><rect width='3' height='4' fill='%23e2e8f0'/></svg>";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

/** A poster card for one show.
 *
 * `reason` is the optional line of body text a recommendation carries
 * (NEU-1114). It is model-authored prose, so it renders as ordinary React text
 * — never `SafeHtml`, never `dangerouslySetInnerHTML`.
 *
 * `inMyShows` marks a show the viewer already tracks (NEU-1057). It is a mark
 * and never a filter — the surfaces that carry it are claims about the world,
 * and seeing your own show in one is a feature. The `Library` icon is the same
 * one `MyShowsToggle` uses, so the mark and the control that sets it read as
 * the same thing.
 */
export function ShowCard({
  show,
  reason,
  inMyShows,
}: {
  show: ShowSummary;
  reason?: string;
  inMyShows?: boolean;
}) {
  const aggregate = tenPointToFiveStar(show.rating_average);
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
      {inMyShows && (
        // `role="img"` with a bare `title` and no text content: the accessible
        // name falls back to the title, so the mark is announced once and
        // still carries a tooltip for the sighted. An sr-only label beside the
        // title would name it *and* describe it with the same words.
        <span
          role="img"
          title="In My Shows"
          className="absolute top-1 left-1 inline-flex items-center rounded-sm bg-foreground/85 p-1 text-background shadow"
        >
          <Library className="h-3 w-3" aria-hidden />
        </span>
      )}
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
              title="TMDB average"
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
        {reason && (
          <p className="truncate text-[10px] text-muted-foreground leading-tight" title={reason}>
            {reason}
          </p>
        )}
      </div>
    </Link>
  );
}
