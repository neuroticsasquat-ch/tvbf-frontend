import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { listConnections } from "@/api/connections";
import { getFriendShows, getFriendWatched } from "@/api/friends";
import { useMyShows, useMyWatched } from "@/api/me";
import type { ConnectionOut, MyShowEntry, WatchedEntry } from "@/api/types";
import { localToday } from "@/api/today";
import { ReportUserButton } from "@/components/ReportUserButton";
import { UserIdentity } from "@/components/UserIdentity";
import { LibraryActiveList } from "@/components/library/LibraryActiveList";
import { LibraryWatchedList } from "@/components/library/LibraryWatchedList";
import { buildCallerLibrary } from "@/components/library/callerLibrary";
import { cn } from "@/lib/cn";
import { nameWithHandle } from "@/lib/userLabel";

type Tab = "active" | "watched";

export function FriendProfilePage() {
  const { userId = "" } = useParams<{ userId: string }>();
  const [tab, setTab] = useState<Tab>("active");
  const navigate = useNavigate();

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0">
          <UserIdentity
            displayName={friend.user.display_name}
            handle={friend.user.handle}
            size="heading"
          />
        </h1>
        {/* Labelled here and compact in the three list rows (NEU-1168 §3.2):
            this page has room for a word, and the rows measurably do not.

            `onBlocked` navigates because this page resolves its subject out of
            `listConnections`, which `useBlockUser` empties — blocking from the
            dialog would otherwise leave the reader on "User not found" as the
            direct result of a deliberate act. */}
        <ReportUserButton
          userId={friend.user.id}
          userName={nameWithHandle(friend.user)}
          variant="labelled"
          onBlocked={() => navigate("/friends?section=connections")}
        />
      </div>

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
        {tab === "active" && <ActiveTab userId={userId} name={friend.user.display_name} />}
        {tab === "watched" && <WatchedTab userId={userId} name={friend.user.display_name} />}
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

function ActiveTab({ userId, name }: { userId: string; name: string }) {
  const today = localToday();
  const { data, isLoading, error } = useQuery<MyShowEntry[]>({
    queryKey: ["friend-shows", userId, today],
    queryFn: () => getFriendShows(userId, { today }),
    retry: false,
  });
  // Caller's own My Shows drives the action button (NEU-127). Indicators and
  // filter (NEU-128/129) will additionally consume my-watched here.
  const callerShowsQuery = useMyShows();
  const callerWatchedQuery = useMyWatched();
  const callerLibrary = useMemo(
    () => buildCallerLibrary(callerShowsQuery.data, callerWatchedQuery.data),
    [callerShowsQuery.data, callerWatchedQuery.data],
  );

  if (error instanceof ApiError && error.status === 404) {
    return <UserNotFound />;
  }
  return (
    <LibraryActiveList
      data={data}
      isLoading={isLoading}
      viewerContext={{ kind: "friend", name }}
      callerLibrary={callerLibrary}
      storagePrefix="friend-active"
    />
  );
}

function WatchedTab({ userId, name }: { userId: string; name: string }) {
  const today = localToday();
  const { data, isLoading, isError, error } = useQuery<WatchedEntry[]>({
    queryKey: ["friend-watched", userId, today],
    queryFn: () => getFriendWatched(userId, { today }),
    retry: false,
  });
  const callerShowsQuery = useMyShows();
  const callerWatchedQuery = useMyWatched();
  const callerLibrary = useMemo(
    () => buildCallerLibrary(callerShowsQuery.data, callerWatchedQuery.data),
    [callerShowsQuery.data, callerWatchedQuery.data],
  );

  if (error instanceof ApiError && error.status === 404) {
    return <UserNotFound />;
  }
  return (
    <LibraryWatchedList
      data={data}
      isLoading={isLoading}
      isError={isError}
      viewerContext={{ kind: "friend", name }}
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
