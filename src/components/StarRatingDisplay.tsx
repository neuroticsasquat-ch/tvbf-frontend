import { Star } from "lucide-react";
import { formatStars } from "@/lib/rating";
import { cn } from "@/lib/cn";

type Props = {
  value: number;
  size?: "sm" | "md";
};

export function StarRatingDisplay({ value, size = "md" }: Props) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <span
      role="img"
      aria-label={`${formatStars(value)} out of 5`}
      className="relative inline-flex items-center"
    >
      <span className="inline-flex text-muted-foreground/40">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(iconClass, "shrink-0")} aria-hidden />
        ))}
      </span>
      <span
        className="absolute inset-0 inline-flex overflow-hidden text-amber-500"
        style={{ width: `${pct}%` }}
        aria-hidden
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(iconClass, "shrink-0 fill-current")} aria-hidden />
        ))}
      </span>
    </span>
  );
}
