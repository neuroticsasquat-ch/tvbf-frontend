import { Star } from "lucide-react";
import { formatStars, ratingLabel, type RatingAttribution } from "@/lib/rating";
import { cn } from "@/lib/cn";

type Props = RatingAttribution & {
  value: number | null | undefined;
  className?: string;
};

/** A rating as a compact chip — the dense half of the app's rating vocabulary.
 *
 * Three kinds, two channels, no text label (NEU-1182 §3.1-§3.2). A person's
 * rating — the viewer's own or one named friend's — is a **filled amber**
 * `Star`; a crowd's is an **unfilled muted** one. Fill and colour are two
 * independent channels, so the distinction survives greyscale and colour
 * blindness. `StarRatingDisplay` is the same claim at the other density and
 * draws the same lucide glyph, which is what makes the two one design system
 * rather than two components that happen to agree.
 *
 * **No text label, and that is a width decision.** The aggregate chip shares
 * the title line with a truncating `h3` on a card that is ~97px wide inside its
 * padding at 375px (`ShowCard`'s own docstring measures it). At
 * `text-[10px] px-1` a starred value is ~32px and `TMDB 4.1` is ~52px — the
 * difference is ~6 characters of show name, on the densest surface in the app.
 *
 * **The free-text `title` prop is gone.** It was the seam that let the viewer's
 * rating and TMDB's average render pixel-identically, separated only by a
 * tooltip that does not exist on touch — and while it survived, a fourth
 * meaning could enter through it. The tooltip and the accessible name are now
 * both derived from `RatingAttribution`, so a badge cannot be constructed
 * without saying which kind of rating it holds.
 *
 * `role="img"` plus `aria-label` replaces the contents in the accessibility
 * tree, adopting `StarRatingDisplay`'s mechanism: the bare number that used to
 * reach a screen reader is now announced as "Your rating: 4.5 out of 5".
 */
export function RatingBadge(props: Props) {
  const { value, className } = props;
  if (value == null || value === 0) return null;
  const label = ratingLabel(props, value);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      <Star
        className={cn(
          "h-3 w-3 shrink-0",
          props.kind === "aggregate" ? "text-muted-foreground" : "fill-current text-amber-500",
        )}
        aria-hidden
      />
      <span>{formatStars(value)}</span>
    </span>
  );
}
