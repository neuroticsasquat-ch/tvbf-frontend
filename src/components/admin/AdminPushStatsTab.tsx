import { useAdminPushStats } from "@/api/admin";

export function AdminPushStatsTab() {
  const { data, isLoading, isError } = useAdminPushStats();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading push stats…</p>;
  if (isError || !data) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Failed to load push stats.
      </p>
    );
  }

  // The contract zero-fills all 30 days, so "no rows" in practice means every
  // row is zero — treat both as the empty state rather than a table of zeros.
  const hasActivity = data.by_day.some((d) => d.sent > 0 || d.failed > 0);
  // Oldest first on the wire; newest first here, so today is the top row.
  const rows = [...data.by_day].reverse();

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <div className="rounded border border-border p-3">
          <dt className="text-xs text-muted-foreground">Subscriptions</dt>
          <dd className="text-2xl font-semibold tabular-nums">{data.subscriptions}</dd>
        </div>
        <div className="rounded border border-border p-3">
          <dt className="text-xs text-muted-foreground">Subscribed users</dt>
          <dd className="text-2xl font-semibold tabular-nums">{data.users_subscribed}</dd>
        </div>
      </dl>

      <section aria-labelledby="push-by-day-heading" className="space-y-2">
        <h3 id="push-by-day-heading" className="text-sm font-medium">
          Deliveries by day
        </h3>
        <p className="text-xs text-muted-foreground">
          Last 30 days, UTC. Retired counts the failures that removed their subscription.
        </p>
        {hasActivity ? (
          <table aria-labelledby="push-by-day-heading" className="w-full text-sm sm:max-w-md">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  Day
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Sent
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Failed
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Retired
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {rows.map((d) => (
                <tr key={d.day}>
                  {/* Rendered verbatim: parsing a bare date as a Date shifts it a
                      day west of UTC. */}
                  <td className="py-1.5">{d.day}</td>
                  <td className="py-1.5 text-right">{d.sent}</td>
                  <td className="py-1.5 text-right">{d.failed}</td>
                  <td className="py-1.5 text-right">{d.retired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No push deliveries in the last 30 days.</p>
        )}
      </section>
    </div>
  );
}
