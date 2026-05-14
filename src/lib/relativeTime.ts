/** Format a past timestamp as a relative string ("3 minutes ago", "2 days ago").
 *
 * Uses `Intl.RelativeTimeFormat` so it picks up locale automatically. The
 * `now` argument is here so tests can pin the comparison point — production
 * callers can omit it.
 */
const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 60 * 60 * 24 * 365 },
  { unit: "month", seconds: 60 * 60 * 24 * 30 },
  { unit: "week", seconds: 60 * 60 * 24 * 7 },
  { unit: "day", seconds: 60 * 60 * 24 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffSeconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 30) return "just now";

  for (const { unit, seconds } of UNITS) {
    if (abs >= seconds) {
      const value = Math.round(diffSeconds / seconds);
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        value,
        unit,
      );
    }
  }
  return "just now";
}
