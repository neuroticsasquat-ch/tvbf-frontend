import { Link } from "react-router";
import { useUpcoming, useWatchNext } from "@/api/me";
import type { UpcomingEntry, WatchNextEntry } from "@/api/types";

const MAX_ITEMS = 12;

type Entry = WatchNextEntry | UpcomingEntry;

function EpisodeTile({ entry }: { entry: Entry }) {
  const { show, episode } = entry;
  const image = show.image_medium ?? show.image_original ?? null;
  return (
    <Link
      to={`/episodes/${episode.id}`}
      className="group relative block aspect-[2/3] w-32 shrink-0 snap-start overflow-hidden rounded border border-border bg-muted"
      title={`${show.name} · S${episode.season}E${episode.number ?? "—"}${episode.name ? ` — ${episode.name}` : ""}`}
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-muted-foreground">
          {show.name}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-1/2 items-end bg-gradient-to-t from-black/95 via-black/70 to-transparent px-2 pb-1.5">
        <span className="text-xs font-semibold text-white [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
          S{episode.season}E{episode.number ?? "—"}
        </span>
      </div>
    </Link>
  );
}

function ViewAllTile({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="flex aspect-[2/3] w-32 shrink-0 snap-start items-center justify-center rounded border border-dashed border-border bg-muted/40 text-sm font-medium text-muted-foreground hover:bg-muted"
    >
      View all →
    </Link>
  );
}

function Section({
  title,
  entries,
  viewAllHref,
  emptyMessage,
}: {
  title: string;
  entries: Entry[] | undefined;
  viewAllHref: string;
  emptyMessage: string;
}) {
  const items = entries ?? [];
  const visible = items.slice(0, MAX_ITEMS);
  const hasMore = items.length > MAX_ITEMS;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {items.length > 0 ? (
          <Link to={viewAllHref} className="text-sm text-muted-foreground hover:underline">
            View all
          </Link>
        ) : null}
      </div>
      {entries === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <ul className="flex snap-x snap-mandatory gap-3">
            {visible.map((entry) => (
              <li key={`${entry.show.id}-${entry.episode.id}`}>
                <EpisodeTile entry={entry} />
              </li>
            ))}
            {hasMore ? (
              <li>
                <ViewAllTile to={viewAllHref} />
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </section>
  );
}

export function HomePage() {
  const watchNext = useWatchNext();
  const upcoming = useUpcoming();

  return (
    <div className="min-w-0 space-y-8">
      <Section
        title="Watch Next"
        entries={watchNext.data}
        viewAllHref="/watch-next"
        emptyMessage="You're caught up. Add shows or wait for new episodes."
      />
      <Section
        title="Upcoming"
        entries={upcoming.data}
        viewAllHref="/upcoming"
        emptyMessage="No upcoming episodes scheduled for your shows."
      />
    </div>
  );
}
