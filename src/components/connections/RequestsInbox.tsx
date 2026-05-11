import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  acceptConnectionRequest,
  deleteConnectionRequest,
  listConnectionRequests,
} from "@/api/connections";
import type { ConnectionRequestList, ConnectionRequestOut, UserBrief } from "@/api/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { useBlockUser } from "./useBlockUser";

const REQUESTS_KEY = ["connection-requests"] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RequestsInbox() {
  const { data, isLoading, isError } = useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: listConnectionRequests,
  });
  const [pendingBlock, setPendingBlock] = useState<UserBrief | null>(null);
  const block = useBlockUser();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError) {
    return <p className="text-sm text-destructive">Failed to load requests.</p>;
  }
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Section title="Incoming" emptyText="No incoming requests.">
        {incoming.map((row) => (
          <IncomingRow key={row.id} row={row} onBlock={() => setPendingBlock(row.requester)} />
        ))}
      </Section>
      <Section title="Outgoing" emptyText="No outgoing requests.">
        {outgoing.map((row) => (
          <OutgoingRow key={row.id} row={row} onBlock={() => setPendingBlock(row.addressee)} />
        ))}
      </Section>
      {pendingBlock && (
        <ConfirmDialog
          title="Block user"
          description={`Block ${pendingBlock.display_name}? This removes the request and prevents future requests until you unblock them.`}
          confirmLabel="Confirm"
          destructive
          pending={block.isPending}
          onConfirm={() => {
            block.mutate(pendingBlock.id);
            setPendingBlock(null);
          }}
          onClose={() => setPendingBlock(null)}
        />
      )}
    </div>
  );
}

function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const list = Array.isArray(children) ? children : [children];
  const hasContent = list.some((c) => c);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {hasContent ? (
        <ul className="flex flex-col divide-y divide-border rounded border border-border">
          {children}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  );
}

function IncomingRow({ row, onBlock }: { row: ConnectionRequestOut; onBlock: () => void }) {
  const accept = useRequestMutation(
    (id: string) => acceptConnectionRequest(id),
    "Could not accept request.",
  );
  const reject = useRequestMutation(
    (id: string) => deleteConnectionRequest(id),
    "Could not reject request.",
  );
  const busy = accept.isPending || reject.isPending;
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm">{row.requester.display_name}</span>
        <span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => accept.mutate(row.id)} disabled={busy}>
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => reject.mutate(row.id)}
          disabled={busy}
        >
          Reject
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onBlock} disabled={busy}>
          Block
        </Button>
      </div>
    </li>
  );
}

function OutgoingRow({ row, onBlock }: { row: ConnectionRequestOut; onBlock: () => void }) {
  const cancel = useRequestMutation(
    (id: string) => deleteConnectionRequest(id),
    "Could not cancel request.",
  );
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm">{row.addressee.display_name}</span>
        <span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => cancel.mutate(row.id)}
          disabled={cancel.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onBlock}
          disabled={cancel.isPending}
        >
          Block
        </Button>
      </div>
    </li>
  );
}

function useRequestMutation(fn: (id: string) => Promise<unknown>, errorMessage: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: REQUESTS_KEY });
      const prev = qc.getQueryData<ConnectionRequestList>(REQUESTS_KEY);
      qc.setQueryData<ConnectionRequestList>(REQUESTS_KEY, (cur) => {
        if (!cur) return cur;
        return {
          incoming: cur.incoming.filter((r) => r.id !== id),
          outgoing: cur.outgoing.filter((r) => r.id !== id),
        };
      });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(REQUESTS_KEY, ctx.prev);
      toast.error(errorMessage);
    },
    onSuccess: () => {
      // Accepted requests turn into connections; refresh that view.
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
  });
}
