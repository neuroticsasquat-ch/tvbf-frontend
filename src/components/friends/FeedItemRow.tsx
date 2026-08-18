import type { ReactNode } from "react";
import { Link } from "react-router";
import { CheckCircle2, ListChecks, PlusCircle, PlayCircle, Star, Trophy } from "lucide-react";
import type { FeedItem } from "@/api/types";
import { StarRatingDisplay } from "@/components/StarRatingDisplay";
import { formatRelativeTime } from "@/lib/relativeTime";
import { seasonLabel } from "@/lib/season";

function ActorLink({ item }: { item: FeedItem }) {
  return (
    <Link to={`/users/${item.actor.id}`} className="font-medium hover:underline">
      {item.actor.display_name}
    </Link>
  );
}

function ShowLink({ item }: { item: FeedItem }) {
  if (!item.show) return null;
  return (
    <Link to={`/shows/${item.show.id}`} className="italic hover:underline">
      {item.show.name}
    </Link>
  );
}

// A copied TV Maze special carries no episode number (NEU-1062), so the `E`
// segment is dropped rather than filled with a placeholder — `0` is a number no
// episode has, and "Special" is a label the API never sent.
//
// Dropping it left the label with nothing to distinguish one special from
// another: every special in a season read as a bare "S1" (NEU-1134). So the
// episode's own name stands in for the missing segment — `S1 · A Christmas
// Special` — and **only** there. A numbered episode keeps `S2E5` exactly as
// before, which is what holds every other feed row byte-identical; the mild
// inconsistency between the two shapes is the price of that, and appending the
// name everywhere is a design change rather than this fix.
//
// `name` is nullable too, and TMDB does leave specials unnamed, so a special
// with no name falls back to the bare `S{season}` rather than trailing a
// separator with nothing after it. Whitespace counts as no name, the same rule
// `seasonLabel` applies one grain up.
function episodeLabel(ep: { season: number; number: number | null; name: string | null }) {
  if (ep.number !== null) return `S${ep.season}E${ep.number}`;
  const name = ep.name?.trim();
  return name ? `S${ep.season} · ${name}` : `S${ep.season}`;
}

function EpisodeLink({ item }: { item: FeedItem }) {
  if (!item.episode) return null;
  return (
    <Link to={`/episodes/${item.episode.id}`} className="hover:underline">
      {episodeLabel(item.episode)}
    </Link>
  );
}

function KindIcon({ kind }: { kind: FeedItem["kind"] }) {
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  switch (kind) {
    case "added_show":
      return <PlusCircle className={cls} aria-hidden />;
    case "watched_episode":
      return <PlayCircle className={cls} aria-hidden />;
    case "watched_episode_run":
      return <ListChecks className={cls} aria-hidden />;
    case "watched_season":
      return <CheckCircle2 className={cls} aria-hidden />;
    case "watched_show":
      return <Trophy className={cls} aria-hidden />;
    case "rated_show":
    case "rated_episode":
      return <Star className={cls} aria-hidden />;
  }
}

function renderBody(item: FeedItem): ReactNode {
  switch (item.kind) {
    case "added_show":
      return (
        <span>
          <ActorLink item={item} /> added <ShowLink item={item} /> to My Shows.
        </span>
      );
    case "watched_episode":
      return (
        <span>
          <ActorLink item={item} /> watched <ShowLink item={item} /> <EpisodeLink item={item} />.
        </span>
      );
    case "watched_episode_run":
      return (
        <span>
          <ActorLink item={item} /> watched {item.rollup_count} episodes of <ShowLink item={item} />
          .
        </span>
      );
    case "watched_season":
      // NEU-1132 added `season_name`, so this site finally routes through
      // `seasonLabel` like every other season label in the SPA (NEU-1129) —
      // still no `season_number === 0` special case, because the label is
      // upstream's to state rather than ours to infer.
      //
      // The label carries its own capital ("Specials", "Season 2"), so the
      // sentence reads "finished Specials of X" rather than "finished season
      // {n} of X". Lowercasing it here would turn TMDB's "Specials" into
      // "specials".
      //
      // A `watched_season` item with no season number cannot be described at
      // all, so it renders no row rather than a headless sentence. The backend
      // always writes the column for this verb; `season_number` is nullable
      // because it is one field across every kind.
      if (item.season_number === null) return null;
      return (
        <span>
          <ActorLink item={item} /> finished{" "}
          {seasonLabel({ number: item.season_number, name: item.season_name })} of{" "}
          <ShowLink item={item} />.
        </span>
      );
    case "watched_show":
      return (
        <span>
          <ActorLink item={item} /> finished <ShowLink item={item} />.
        </span>
      );
    case "rated_show":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <ActorLink item={item} /> rated <ShowLink item={item} />
          {item.stars !== null && (
            <StarRatingDisplay
              kind="other"
              ownerName={item.actor.display_name}
              value={item.stars}
              size="sm"
            />
          )}
        </span>
      );
    case "rated_episode":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <ActorLink item={item} /> rated <ShowLink item={item} /> <EpisodeLink item={item} />
          {item.stars !== null && (
            <StarRatingDisplay
              kind="other"
              ownerName={item.actor.display_name}
              value={item.stars}
              size="sm"
            />
          )}
        </span>
      );
  }
}

export function FeedItemRow({ item }: { item: FeedItem }) {
  // An item with no describable body is dropped whole — an icon and a timestamp
  // with no sentence reads as a rendering bug rather than as activity.
  //
  // `ActivityFeed` picks its empty state off the raw payload length, so a page
  // of *only* dropped items would render a bare list rather than "no activity".
  // Left alone deliberately: that needs a whole page of `watched_season` events
  // carrying no season number, which the backend cannot emit, and closing it
  // means either restating "is this describable" inside `ActivityFeed` or
  // exporting this function purely to use as a predicate — both worse than the
  // residue.
  const body = renderBody(item);
  if (body === null) return null;
  return (
    <li data-testid="feed-row" data-kind={item.kind} className="flex items-start gap-3 py-2">
      <KindIcon kind={item.kind} />
      <div className="flex-1 text-sm">{body}</div>
      <time
        dateTime={item.occurred_at}
        title={item.occurred_at}
        className="text-xs text-muted-foreground whitespace-nowrap"
      >
        {formatRelativeTime(item.occurred_at)}
      </time>
    </li>
  );
}
