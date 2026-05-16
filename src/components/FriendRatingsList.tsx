import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getEpisodeFriendRatings, getShowFriendRatings } from "@/api/friends";
import type { FriendRatingsResponse } from "@/api/types";
import { useAuth } from "@/components/AuthContext";
import { StarRatingDisplay } from "@/components/StarRatingDisplay";
import { formatRelativeTime } from "@/lib/relativeTime";

type Target = { showId: number } | { episodeId: number };

type Props = Target;

function Items({ data }: { data: FriendRatingsResponse }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {data.items.map((item) => (
        <li
          key={item.user_id}
          className="flex flex-wrap items-center gap-2 text-muted-foreground"
        >
          <Link
            to={`/users/${item.user_id}`}
            className="hover:underline text-foreground"
          >
            {item.display_name}
          </Link>
          <StarRatingDisplay value={item.stars} size="sm" />
          <span>· {formatRelativeTime(item.rated_at)}</span>
        </li>
      ))}
    </ul>
  );
}

export function FriendRatingsList(props: Props) {
  const { user } = useAuth();
  const isShow = "showId" in props;
  const id = isShow ? props.showId : props.episodeId;
  const { data } = useQuery<FriendRatingsResponse>({
    queryKey: ["friend-ratings", isShow ? "show" : "episode", id],
    queryFn: () =>
      isShow ? getShowFriendRatings(id) : getEpisodeFriendRatings(id),
    enabled: !!user,
  });

  if (!data) return null;
  if (data.count === 0) return null;

  return (
    <section aria-label="Friend ratings" className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Friends:</span>
        {data.avg !== null && <StarRatingDisplay value={data.avg} size="sm" />}
        <span className="text-muted-foreground">
          · {data.count} {data.count === 1 ? "friend" : "friends"}
        </span>
      </div>
      <Items data={data} />
    </section>
  );
}
