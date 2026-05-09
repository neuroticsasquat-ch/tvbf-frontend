import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { blockUser } from "@/api/connections";
import type {
  BlockedUserOut,
  ConnectionOut,
  ConnectionRequestList,
} from "@/api/types";

const BLOCKS_KEY = ["blocks"] as const;
const CONNECTIONS_KEY = ["connections"] as const;
const REQUESTS_KEY = ["connection-requests"] as const;

/** Block a user. Removes them from connections + pending requests caches and
 * prepends them to the blocked-users cache so all three tabs reflect the change
 * without an additional refetch. */
export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onMutate: async (userId: string) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: BLOCKS_KEY }),
        qc.cancelQueries({ queryKey: CONNECTIONS_KEY }),
        qc.cancelQueries({ queryKey: REQUESTS_KEY }),
      ]);
      const prev = {
        blocks: qc.getQueryData<BlockedUserOut[]>(BLOCKS_KEY),
        connections: qc.getQueryData<ConnectionOut[]>(CONNECTIONS_KEY),
        requests: qc.getQueryData<ConnectionRequestList>(REQUESTS_KEY),
      };
      qc.setQueryData<ConnectionOut[]>(CONNECTIONS_KEY, (cur) =>
        cur ? cur.filter((c) => c.user.id !== userId) : cur,
      );
      qc.setQueryData<ConnectionRequestList>(REQUESTS_KEY, (cur) => {
        if (!cur) return cur;
        return {
          incoming: cur.incoming.filter(
            (r) => r.requester.id !== userId && r.addressee.id !== userId,
          ),
          outgoing: cur.outgoing.filter(
            (r) => r.requester.id !== userId && r.addressee.id !== userId,
          ),
        };
      });
      return prev;
    },
    onSuccess: (data) => {
      qc.setQueryData<BlockedUserOut[]>(BLOCKS_KEY, (cur) => {
        const next = cur ? cur.filter((b) => b.user.id !== data.user.id) : [];
        return [data, ...next];
      });
    },
    onError: (_err, _userId, ctx) => {
      if (!ctx) return;
      if (ctx.blocks !== undefined) qc.setQueryData(BLOCKS_KEY, ctx.blocks);
      if (ctx.connections !== undefined) {
        qc.setQueryData(CONNECTIONS_KEY, ctx.connections);
      }
      if (ctx.requests !== undefined) {
        qc.setQueryData(REQUESTS_KEY, ctx.requests);
      }
      toast.error("Could not block user.");
    },
  });
}
