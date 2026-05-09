import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listConnections, removeConnection } from "@/api/connections";
import type { ConnectionOut } from "@/api/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { useBlockUser } from "./useBlockUser";

const CONNECTIONS_KEY = ["connections"] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ConnectionsList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: CONNECTIONS_KEY,
    queryFn: listConnections,
  });
  const [pendingRemove, setPendingRemove] = useState<ConnectionOut | null>(null);
  const [pendingBlock, setPendingBlock] = useState<ConnectionOut | null>(null);
  const block = useBlockUser();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError) {
    return <p className="text-sm text-destructive">Failed to load connections.</p>;
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No connections yet. Find people to connect with above.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-border rounded border border-border">
        {data.map((c) => (
          <li key={c.user.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <Link to={`/users/${c.user.id}`} className="flex flex-col hover:underline">
              <span className="text-sm">{c.user.display_name}</span>
              <span className="text-xs text-muted-foreground">Connected {formatDate(c.since)}</span>
            </Link>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPendingRemove(c)}>
                Remove
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPendingBlock(c)}>
                Block
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {pendingRemove && (
        <RemoveConfirmDialog connection={pendingRemove} onClose={() => setPendingRemove(null)} />
      )}
      {pendingBlock && (
        <ConfirmDialog
          title="Block user"
          description={`Block ${pendingBlock.user.display_name}? This removes the connection and prevents future requests until you unblock them.`}
          confirmLabel="Confirm"
          destructive
          pending={block.isPending}
          onConfirm={() => {
            block.mutate(pendingBlock.user.id);
            setPendingBlock(null);
          }}
          onClose={() => setPendingBlock(null)}
        />
      )}
    </>
  );
}

function RemoveConfirmDialog({
  connection,
  onClose,
}: {
  connection: ConnectionOut;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (userId: string) => removeConnection(userId),
    onMutate: async (userId: string) => {
      await qc.cancelQueries({ queryKey: CONNECTIONS_KEY });
      const prev = qc.getQueryData<ConnectionOut[]>(CONNECTIONS_KEY);
      qc.setQueryData<ConnectionOut[]>(CONNECTIONS_KEY, (cur) =>
        cur ? cur.filter((c) => c.user.id !== userId) : cur,
      );
      return { prev };
    },
    onError: (_err, _userId, ctx) => {
      if (ctx?.prev) qc.setQueryData(CONNECTIONS_KEY, ctx.prev);
      toast.error("Could not remove connection.");
    },
  });

  function confirm() {
    mutation.mutate(connection.user.id);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-label="Remove connection"
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-20"
    >
      <div className="bg-background rounded p-6 w-96 border border-border">
        <h2 className="text-lg font-semibold mb-2">Remove connection</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Disconnect from {connection.user.display_name}? You can reconnect later by sending another
          request.
        </p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={confirm} disabled={mutation.isPending}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
