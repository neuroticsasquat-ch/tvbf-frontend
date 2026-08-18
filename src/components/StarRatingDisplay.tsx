import { Star } from "lucide-react";
import { ratingLabel, type RatingAttribution } from "@/lib/rating";
import { cn } from "@/lib/cn";

type Props = RatingAttribution & {
  value: number;
  size?: "sm" | "md";
};

/** A rating as five stars — the roomy half of the app's rating vocabulary.
 *
 * Same three kinds and the same amber-is-a-person / muted-is-a-crowd rule as
 * `RatingBadge` (NEU-1182 §3.2); the choice between the two forms is density,
 * not meaning.
 *
 * **Colour is the only kind channel at this density, and that is forced rather
 * than chosen.** The chip carries fill *and* colour, because the value sits
 * beside it as a number — so an aggregate there can afford an unfilled star.
 * Here the clipped fill *is* how the value is drawn, so §3.2's literal
 * "unfilled muted stars" spends the data to carry the kind. Built that way and
 * looked at under §10's 375px sweep, a 3.5 friends-average rendered as five
 * identical faint outlines: a 40%-vs-100% opacity step on one stroke is not a
 * readable scale in dark mode, and the value was simply gone. So an aggregate
 * keeps its fill and goes muted, which still reads instantly against `other`'s
 * amber one line below it — the comparison that surface exists to make.
 *
 * `StarRatingInput` is deliberately untouched: it is an input, its amber is the
 * interactive affordance, and the viewer editing their own rating is
 * unambiguous by construction.
 */
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
          <Star key={i} className={cn(iconClass, "shrink-0 fill-current")} aria-hidden />
        ))}
      </span>
    </span>
  );
}
