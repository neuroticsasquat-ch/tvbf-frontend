import { formatStars } from "@/lib/rating";
import { cn } from "@/lib/cn";

type Props = {
  value: number | null | undefined;
  title?: string;
  className?: string;
};

export function RatingBadge({ value, title, className }: Props) {
  if (value == null || value === 0) return null;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <span aria-hidden>★</span>
      <span>{formatStars(value)}</span>
    </span>
  );
}
