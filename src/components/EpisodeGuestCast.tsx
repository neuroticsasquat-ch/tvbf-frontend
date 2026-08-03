import { useEpisodeGuestCast } from "@/api/shows";
import { CastList } from "@/components/CastList";
import { ErrorState } from "@/components/ErrorState";

/** Guest cast for one episode. 96% of episodes have none, so the overwhelmingly
 * common outcome is that this renders nothing at all — no header, no
 * placeholder, no reserved space. */
export function EpisodeGuestCast({ episodeId }: { episodeId: number }) {
  const { data, isError, error, refetch } = useEpisodeGuestCast(episodeId);

  // A failed request must not look like the (near-universal) empty case.
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  return <CastList entries={data ?? []} title="Guest cast" headingId="guest-cast-heading" />;
}
