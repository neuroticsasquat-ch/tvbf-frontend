import { Link } from "react-router";
import {
  CheckCircle2,
  ListChecks,
  PlusCircle,
  PlayCircle,
  Star,
  Trophy,
} from "lucide-react";
import type { FeedItem } from "@/api/types";
import { StarRatingDisplay } from "@/components/StarRatingDisplay";
import { formatRelativeTime } from "@/lib/relativeTime";

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

function episodeLabel(ep: { season: number; number: number }) {
  return `S${ep.season}E${ep.number}`;
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

function Body({ item }: { item: FeedItem }) {
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
          <ActorLink item={item} /> watched <ShowLink item={item} />{" "}
          <EpisodeLink item={item} />.
        </span>
      );
    case "watched_episode_run":
      return (
        <span>
          <ActorLink item={item} /> watched {item.rollup_count} episodes of{" "}
          <ShowLink item={item} />.
        </span>
      );
    case "watched_season":
      return (
        <span>
          <ActorLink item={item} /> finished season {item.season_number} of{" "}
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
          {item.stars !== null && <StarRatingDisplay value={item.stars} size="sm" />}
        </span>
      );
    case "rated_episode":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <ActorLink item={item} /> rated <ShowLink item={item} />{" "}
          <EpisodeLink item={item} />
          {item.stars !== null && <StarRatingDisplay value={item.stars} size="sm" />}
        </span>
      );
  }
}

export function FeedItemRow({ item }: { item: FeedItem }) {
  return (
    <li
      data-testid="feed-row"
      data-kind={item.kind}
      className="flex items-start gap-3 py-2"
    >
      <KindIcon kind={item.kind} />
      <div className="flex-1 text-sm">
        <Body item={item} />
      </div>
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
