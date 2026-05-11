import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listBlocks, unblockUser } from "@/api/connections";
import type { BlockedUserOut } from "@/api/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";

const BLOCKS_KEY = ["blocks"] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BlockedList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: BLOCKS_KEY,
    queryFn: listBlocks,
  });
  const [pending, setPending] = useState<BlockedUserOut | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError) {
    return <p className="text-sm text-destructive">Failed to load blocked users.</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No blocked users.</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-border rounded border border-border">
        {data.map((b) => (
          <li key={b.user.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm">{b.user.display_name}</span>
              <span className="text-xs text-muted-foreground">
                Blocked {formatDate(b.blocked_at)}
              </span>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setPending(b)}>
              Unblock
            </Button>
          </li>
        ))}
      </ul>
      {pending && <UnblockConfirm row={pending} onClose={() => setPending(null)} />}
    </>
  );
}

function UnblockConfirm({ row, onClose }: { row: BlockedUserOut; onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onMutate: async (userId: string) => {
      await qc.cancelQueries({ queryKey: BLOCKS_KEY });
      const prev = qc.getQueryData<BlockedUserOut[]>(BLOCKS_KEY);
      qc.setQueryData<BlockedUserOut[]>(BLOCKS_KEY, (cur) =>
        cur ? cur.filter((b) => b.user.id !== userId) : cur,
      );
      return { prev };
    },
    onError: (_err, _userId, ctx) => {
      if (ctx?.prev) qc.setQueryData(BLOCKS_KEY, ctx.prev);
      toast.error("Could not unblock user.");
    },
  });
  return (
    <ConfirmDialog
      title="Unblock user"
      description={`Unblock ${row.user.display_name}? They will be able to send you connection requests again.`}
      confirmLabel="Confirm"
      pending={mutation.isPending}
      onConfirm={() => {
        mutation.mutate(row.user.id);
        onClose();
      }}
      onClose={onClose}
    />
  );
}
