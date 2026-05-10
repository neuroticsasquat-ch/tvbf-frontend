import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { listConnections } from "@/api/connections";
import { getFriendShows, getFriendWatched } from "@/api/friends";
import { useMyShows } from "@/api/me";
import type { ConnectionOut, MyShowEntry, WatchedEntry } from "@/api/types";
import { localToday } from "@/api/today";
import { LibraryActiveList } from "@/components/library/LibraryActiveList";
import { LibraryWatchedList } from "@/components/library/LibraryWatchedList";
import { buildCallerLibrary } from "@/components/library/callerLibrary";
import { cn } from "@/lib/cn";

type Tab = "active" | "watched";

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
        "px-3 py-2 text-sm border-b-2 -mb-px rounded-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
    queryKey: ["friend-shows", userId, today],
    queryFn: () => getFriendShows(userId, { today }),
    retry: false,
  });
  // Caller's own My Shows drives the action button (NEU-127). Indicators and
  // filter (NEU-128/129) will additionally consume my-watched here.
  const callerShowsQuery = useMyShows();
  const callerLibrary = useMemo(
    () => buildCallerLibrary(callerShowsQuery.data),
    [callerShowsQuery.data],
  );

  if (error instanceof ApiError && error.status === 404) {
    return <UserNotFound />;
  }
  return (
    <LibraryActiveList
      data={data}
      isLoading={isLoading}
      viewerContext="friend"
      callerLibrary={callerLibrary}
      storagePrefix="friend-active"
    />
  );
}

function WatchedTab({ userId }: { userId: string }) {
  const today = localToday();
  const { data, isLoading, isError, error } = useQuery<WatchedEntry[]>({
    queryKey: ["friend-watched", userId, today],
    queryFn: () => getFriendWatched(userId, { today }),
    retry: false,
  });
  const callerShowsQuery = useMyShows();
  const callerLibrary = useMemo(
    () => buildCallerLibrary(callerShowsQuery.data),
    [callerShowsQuery.data],
  );

  if (error instanceof ApiError && error.status === 404) {
    return <UserNotFound />;
  }
  return (
    <LibraryWatchedList
      data={data}
      isLoading={isLoading}
      isError={isError}
      viewerContext="friend"
      callerLibrary={callerLibrary}
      storagePrefix="friend-watched"
    />
  );
}

function UserNotFound() {
  return (
    <section className="flex flex-col gap-2 py-8 text-center">
      <h1 className="text-xl font-semibold">User not found</h1>
      <p className="text-sm text-muted-foreground">This profile is unavailable.</p>
    </section>
  );
}
