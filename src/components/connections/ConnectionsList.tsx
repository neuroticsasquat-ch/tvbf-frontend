import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listConnections, removeConnection } from "@/api/connections";
import type { ConnectionOut } from "@/api/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReportUserButton } from "@/components/ReportUserButton";
import { UserIdentity } from "@/components/UserIdentity";
import { nameWithHandle } from "@/lib/userLabel";
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
            <Link
              to={`/users/${c.user.id}`}
              className="flex min-w-0 flex-1 flex-col hover:underline"
            >
              <UserIdentity displayName={c.user.display_name} handle={c.user.handle} />
              <span className="text-xs text-muted-foreground">Connected {formatDate(c.since)}</span>
            </Link>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPendingRemove(c)}>
                Remove
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPendingBlock(c)}>
                Block
              </Button>
              <ReportUserButton userId={c.user.id} user={c.user} />
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
          description={`Block ${nameWithHandle(pendingBlock.user)}? This removes the connection and prevents future requests until you unblock them.`}
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

  // Converted to the shared `ConfirmDialog` (NEU-1168 §5): it was the same
  // picture built differently, sitting in the one file that already renders
  // one. Only the presentation is replaced — the mutation stays here.
  return (
    <ConfirmDialog
      title="Remove connection"
      description={`Disconnect from ${nameWithHandle(connection.user)}? You can reconnect later by sending another request.`}
      confirmLabel="Confirm"
      pending={mutation.isPending}
      onConfirm={() => {
        mutation.mutate(connection.user.id);
        onClose();
      }}
      onClose={onClose}
    />
  );
}
