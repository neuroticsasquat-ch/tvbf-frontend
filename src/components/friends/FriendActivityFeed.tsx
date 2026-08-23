import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getFriendFeed } from "@/api/friends";
import type { FeedItem } from "@/api/types";
import { FeedItemRow } from "@/components/friends/FeedItemRow";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingSkeleton() {
  return (
    <ul aria-busy="true" className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 py-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-10" />
        </li>
      ))}
    </ul>
  );
}

const US_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
};

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, US_DATE_FORMAT);
}

function EmptyState() {
  return (
    <p className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      No activity yet.
    </p>
  );
}

export function FriendActivityFeed({ userId }: { userId: string }) {
  const query = useInfiniteQuery<import("@/api/types").FeedPage>({
    queryKey: ["friend-feed", userId],
    queryFn: ({ pageParam }) =>
      getFriendFeed(userId, (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    staleTime: 0,
  });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          query.hasNextPage &&
          !query.isFetchingNextPage
        ) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "200px 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [query]);

  const items = (query.data?.pages ?? []).flatMap((p) => p.items);

  const dayGroups = useMemo(() => {
    const groups: { date: string; items: FeedItem[] }[] = [];
    for (const item of items) {
      const date = new Date(item.occurred_at).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.date === date) {
        last.items.push(item);
      } else {
        groups.push({ date, items: [item] });
      }
    }
    return groups;
  }, [items]);

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Failed to load activity.
      </p>
    );
  }

  if (items.length === 0) return <EmptyState />;

  return (
    <>
      {dayGroups.map((group) => (
        <section key={group.date} className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1 z-10">
            {formatDayLabel(group.date)}
          </h3>
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <FeedItemRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
      <div ref={sentinelRef} aria-hidden className="h-1" />
      {query.isFetchingNextPage && (
        <p
          className="py-3 text-center text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Loading more…
        </p>
      )}
    </>
  );
}
