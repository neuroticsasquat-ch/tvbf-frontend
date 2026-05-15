import { useFeed } from "@/api/me";
import { FeedItemRow } from "@/components/friends/FeedItemRow";

export function FriendsFeedPage() {
  const query = useFeed();

  if (query.isLoading) return <p>Loading…</p>;
  if (query.isError) return <p>Failed to load activity.</p>;

  const items = (query.data?.pages ?? []).flatMap((p) => p.items);

  if (items.length === 0) return <p>No friend activity yet.</p>;

  return (
    <section aria-label="Friends activity">
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <FeedItemRow key={item.id} item={item} />
        ))}
      </ul>
      {query.hasNextPage && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="mt-4"
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}
