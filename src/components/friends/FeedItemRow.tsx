import { Link } from "react-router";
import type { FeedItem } from "@/api/types";

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
    <Link to={`/shows/${item.show.id}`} className="hover:underline">
      {item.show.name}
    </Link>
  );
}

function EpisodeLink({ item }: { item: FeedItem }) {
  if (!item.episode) return null;
  const label = item.episode.name
    ? `S${item.episode.season}E${item.episode.number} · ${item.episode.name}`
    : `S${item.episode.season}E${item.episode.number}`;
  return (
    <Link to={`/episodes/${item.episode.id}`} className="hover:underline">
      {label}
    </Link>
  );
}

export function FeedItemRow({ item }: { item: FeedItem }) {
  switch (item.kind) {
    case "added_show":
      return (
        <li data-testid="feed-row" data-kind={item.kind}>
          <ActorLink item={item} /> added <ShowLink item={item} /> to My Shows.
        </li>
      );
    case "watched_episode":
      return (
        <li data-testid="feed-row" data-kind={item.kind}>
          <ActorLink item={item} /> watched <EpisodeLink item={item} /> of <ShowLink item={item} />.
        </li>
      );
    case "watched_episode_run":
      return (
        <li data-testid="feed-row" data-kind={item.kind}>
          <ActorLink item={item} /> watched {item.rollup_count} episodes of <ShowLink item={item} />.
        </li>
      );
    case "watched_season":
      return (
        <li data-testid="feed-row" data-kind={item.kind}>
          <ActorLink item={item} /> finished Season {item.season_number} of <ShowLink item={item} />.
        </li>
      );
    case "watched_show":
      return (
        <li data-testid="feed-row" data-kind={item.kind}>
          <ActorLink item={item} /> finished <ShowLink item={item} />.
        </li>
      );
    case "rated_show":
      return (
        <li data-testid="feed-row" data-kind={item.kind}>
          <ActorLink item={item} /> rated <ShowLink item={item} /> {item.stars} stars.
        </li>
      );
    case "rated_episode":
      return (
        <li data-testid="feed-row" data-kind={item.kind}>
          <ActorLink item={item} /> rated <EpisodeLink item={item} /> of <ShowLink item={item} />{" "}
          {item.stars} stars.
        </li>
      );
  }
}
