import { useEffect, useRef } from "react";
import { useFeed } from "@/api/me";
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

function EmptyState() {
  return (
    <p className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      No activity from your friends yet. When they add shows, mark episodes
      watched, or leave ratings, it'll show up here.
    </p>
  );
}

export function ActivityFeed() {
  const query = useFeed();
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

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Failed to load activity.
      </p>
    );
  }

  const items = (query.data?.pages ?? []).flatMap((p) => p.items);

  if (items.length === 0) return <EmptyState />;

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <FeedItemRow key={item.id} item={item} />
        ))}
      </ul>
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
