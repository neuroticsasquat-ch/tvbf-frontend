import { Link } from "react-router";
import { Tv } from "lucide-react";
import { useWatchNext } from "@/api/me";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatAirdate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

export function NextEpisodeCard({ showId }: { showId: number }) {
  const { data } = useWatchNext();
  const entry = data?.find((e) => e.show.id === showId);
  if (!entry) return null;
  const ep = entry.episode;
  const thumbnail = ep.image_medium;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Watch Next</h2>
      <div className="border border-border rounded p-3 hover:bg-accent">
        <div className="flex items-center gap-4">
          <Link to={`/episodes/${ep.id}`} className="flex flex-1 min-w-0 items-center gap-4">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt=""
                className="w-32 aspect-video object-cover rounded shrink-0"
                loading="lazy"
              />
            ) : (
              <div
                aria-hidden
                className="w-32 aspect-video rounded shrink-0 bg-muted text-muted-foreground flex items-center justify-center"
              >
                <Tv className="h-6 w-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground leading-tight">
                S{ep.season}E{ep.number}
              </p>
              {ep.name && (
                <p className="text-sm font-semibold text-foreground leading-tight truncate">
                  {ep.name}
                </p>
              )}
              {ep.airdate && (
                <p className="text-xs text-muted-foreground leading-tight">
                  {formatAirdate(ep.airdate)}
                </p>
              )}
            </div>
          </Link>
          <div className="ml-auto shrink-0">
            <EpisodeWatchCheckbox showId={showId} episodeId={ep.id} watched={ep.watched ?? false} />
          </div>
        </div>
      </div>
    </section>
  );
}
