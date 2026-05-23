import { useState } from "react";
import { useInvites, useSendInvite } from "@/api/adminInvites";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function AdminInvitesTab() {
  const [email, setEmail] = useState("");
  const send = useSendInvite();
  const { data, isLoading, isError } = useInvites();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    send.mutate(trimmed, {
      onSuccess: () => setEmail(""),
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="invite-email" className="block text-sm">
          Send an invite
        </label>
        <p className="text-xs text-muted-foreground">
          The recipient will get an email with a signup link that prefills their
          invite code and email address.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="someone@example.com"
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={send.isPending}
            className="rounded bg-foreground text-background px-3 py-2 text-sm disabled:opacity-50"
          >
            {send.isPending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>

      <section aria-label="Existing invites" className="space-y-2">
        <h3 className="text-sm font-medium">Existing invites</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading invites…</p>
        ) : isError || !data ? (
          <p role="alert" className="text-sm text-red-600">
            Failed to load invites.
          </p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites issued yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((row) => (
              <li
                key={row.code}
                className="flex items-center gap-3 py-3 text-sm"
                data-testid="invite-row"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {row.email_hint ?? "(no email)"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Code <code className="font-mono">{row.code}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sent {formatDate(row.created_at)}
                  </p>
                </div>
                <span className="shrink-0 text-xs">
                  {row.consumed_at ? (
                    <span
                      className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                      title={`Consumed ${formatDate(row.consumed_at)}`}
                    >
                      Consumed
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Pending</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
