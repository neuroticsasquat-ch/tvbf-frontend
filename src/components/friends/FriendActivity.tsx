import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getEpisodeFriendsWatched, getShowFriendActivity } from "@/api/friends";
import type { ShowFriendActivity, UserBrief } from "@/api/types";
import { useAuth } from "@/components/AuthContext";

function FriendList({ users }: { users: UserBrief[] }) {
  return (
    <span className="text-sm text-muted-foreground">
      {users.map((u, i) => (
        <span key={u.id}>
          {i > 0 && " · "}
          <Link to={`/users/${u.id}`} className="hover:underline text-foreground">
            {u.display_name}
          </Link>
        </span>
      ))}
    </span>
  );
}

export function ShowFriendActivityStrip({ showId }: { showId: number }) {
  const { user } = useAuth();
  const { data } = useQuery<ShowFriendActivity>({
    queryKey: ["friend-activity", "show", showId],
    queryFn: () => getShowFriendActivity(showId),
    enabled: !!user,
  });
  if (!data) return null;
  if (data.in_my_shows.length === 0 && data.watched.length === 0) return null;

  return (
    <section aria-label="Friends engaged with this show" className="flex flex-col gap-1 text-sm">
      {data.in_my_shows.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="font-medium">In My Shows:</span>
          <FriendList users={data.in_my_shows} />
        </div>
      )}
      {data.watched.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="font-medium">Watched:</span>
          <FriendList users={data.watched} />
        </div>
      )}
    </section>
  );
}

export function EpisodeFriendsWatched({ episodeId }: { episodeId: number }) {
  const { user } = useAuth();
  const { data } = useQuery<UserBrief[]>({
    queryKey: ["friend-activity", "episode", episodeId],
    queryFn: () => getEpisodeFriendsWatched(episodeId),
    enabled: !!user,
  });
  if (!data || data.length === 0) return null;

  return (
    <section
      aria-label="Friends who watched this episode"
      className="flex flex-wrap items-baseline gap-1 text-sm"
    >
      <span className="font-medium">Watched by:</span>
      <FriendList users={data} />
    </section>
  );
}
