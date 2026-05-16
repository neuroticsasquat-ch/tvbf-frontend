import { useQuery } from "@tanstack/react-query";
import { listConnectionRequests } from "@/api/connections";
import type { ConnectionRequestList } from "@/api/types";

const TWO_MINUTES = 2 * 60 * 1000;

/** Fetch the caller's connection-requests once (shared cache with the
 * Requests tab) and report how many are pending in the inbox. Returns 0
 * while loading or unauthenticated. Surfaces nav and tab badges. */
export function useIncomingRequestCount(enabled: boolean): number {
  const query = useQuery<ConnectionRequestList>({
    queryKey: ["connection-requests"],
    queryFn: listConnectionRequests,
    enabled,
    staleTime: TWO_MINUTES,
  });
  return query.data?.incoming.length ?? 0;
}
