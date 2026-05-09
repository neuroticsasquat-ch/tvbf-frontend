import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { listConnections } from "@/api/connections";
import { getFriendShows, getFriendWatched } from "@/api/friends";
import type {
  ConnectionOut,
  MyShowEntry,
  WatchedEntry,
  WatchedStatusFilter,
} from "@/api/types";
import { localToday } from "@/api/today";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Tab = "active" | "watched";

const STATUS_FILTERS: { key: WatchedStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "finished", label: "Finished" },
  { key: "in_progress", label: "In progress" },
];

export function FriendProfilePage() {
  const { userId = "" } = useParams<{ userId: string }>();
  const [tab, setTab] = useState<Tab>("active");

  const connectionsQuery = useQuery<ConnectionOut[]>({
    queryKey: ["connections"],
    queryFn: listConnections,
  });

  const friend = connectionsQuery.data?.find((c) => c.user.id === userId);

  if (connectionsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!friend) {
    return <UserNotFound />;
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{friend.user.display_name}</h1>

      <div
        role="tablist"
        aria-label="Friend library sections"
        className="flex gap-1 border-b border-border"
      >
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          Active
        </TabButton>
        <TabButton active={tab === "watched"} onClick={() => setTab("watched")}>
          Watched
        </TabButton>
      </div>

      <div role="tabpanel">
        {tab === "active" && <ActiveTab userId={userId} />}
        {tab === "watched" && <WatchedTab userId={userId} />}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-sm border-b-2 -mb-px",
        active
          ? "border-foreground font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ActiveTab({ userId }: { userId: string }) {
  const today = localToday();
  const { data, isLoading, error } = useQuery<MyShowEntry[]>({
    queryKey: ["friend-shows", userId, "recent_activity", today],
    queryFn: () => getFriendShows(userId, { sort: "recent_activity", today }),
    retry: false,
  });

  if (error instanceof ApiError && error.status === 404) {
    return <UserNotFound />;
  }
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing tracked here yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded border border-border">
      {data.map((entry) => (
        <li key={entry.show.id} className="px-3 py-2">
          <Link
            to={`/shows/${entry.show.id}`}
            className="text-sm hover:underline"
          >
            {entry.show.name}
          </Link>
          {entry.total_episode_count > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {entry.watched_episode_count}/{entry.total_episode_count}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function WatchedTab({ userId }: { userId: string }) {
  const [status, setStatus] = useState<WatchedStatusFilter>("all");

  const { data, isLoading, error } = useQuery<WatchedEntry[]>({
    queryKey: ["friend-watched", userId, status, "last_watched_desc"],
    queryFn: () =>
      getFriendWatched(userId, { status, sort: "last_watched_desc" }),
    retry: false,
  });

  if (error instanceof ApiError && error.status === 404) {
    return <UserNotFound />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            size="sm"
            variant={status === f.key ? "default" : "outline"}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {!isLoading && data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {status === "finished"
            ? "Nothing finished yet."
            : status === "in_progress"
              ? "Nothing in progress."
              : "No watch history."}
        </p>
      )}
      {!isLoading && data && data.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded border border-border">
          {data.map((entry) => (
            <li
              key={entry.show.id}
              className="flex items-center gap-3 px-3 py-2"
            >
              <Link
                to={`/shows/${entry.show.id}`}
                className="text-sm hover:underline"
              >
                {entry.show.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {entry.watched_episode_count}/{entry.aired_episode_count}
              </span>
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded border",
                  entry.status === "finished"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-border text-muted-foreground",
                )}
              >
                {entry.status === "finished" ? "Finished" : "In progress"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UserNotFound() {
  return (
    <section className="flex flex-col gap-2 py-8 text-center">
      <h1 className="text-xl font-semibold">User not found</h1>
      <p className="text-sm text-muted-foreground">
        This profile is unavailable.
      </p>
    </section>
  );
}
