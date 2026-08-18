import { Star } from "lucide-react";
import { ratingLabel, type RatingAttribution } from "@/lib/rating";
import { cn } from "@/lib/cn";

/** A rating as five stars — the roomy half of the app's rating vocabulary.
 *
 * Same three kinds and the same amber-is-a-person / muted-is-a-crowd rule as
 * `RatingBadge` (NEU-1182 §3.2); the choice between the two forms is density,
 * not meaning. The overlay keeps its clip either way, so an aggregate still
 * reads its value off the stars rather than only out of the label.
 *
 * `StarRatingInput` is deliberately untouched: it is an input, its amber is the
 * interactive affordance, and the viewer editing their own rating is
 * unambiguous by construction.
 */
type Props = RatingAttribution & {
  value: number;
  size?: "sm" | "md";
};

export function StarRatingDisplay(props: Props) {
  const { value, size = "md" } = props;
  const pct = Math.max(0, Math.min(5, value)) * 20;
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const crowd = props.kind === "aggregate";
  return (
    <span
      role="img"
      aria-label={ratingLabel(props, value)}
      className="relative inline-flex items-center"
    >
      <span className="inline-flex text-muted-foreground/40">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(iconClass, "shrink-0")} aria-hidden />
        ))}
      </span>
      <span
        className={cn(
          "absolute inset-0 inline-flex overflow-hidden",
          crowd ? "text-muted-foreground" : "text-amber-500",
        )}
        style={{ width: `${pct}%` }}
        aria-hidden
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className={cn(iconClass, "shrink-0", !crowd && "fill-current")}
            aria-hidden
          />
        ))}
      </span>
    </span>
  );
}
