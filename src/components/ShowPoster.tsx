import type { ReactNode } from "react";
import { Link } from "react-router";

import { InMyShowsBadge } from "@/components/InMyShowsBadge";
import { RatingBadge } from "@/components/RatingBadge";
import { cn } from "@/lib/cn";

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'><rect width='3' height='4' fill='%23e2e8f0'/></svg>";

/** Every poster in the app is this shape, and the overlay layer below has to
 * agree with it — one constant rather than two strings that drift. */
const POSTER_ASPECT = "aspect-[210/295]";

/** The two real poster widths in the app: a grid card and a list row's thumb. */
export type ShowPosterSize = "card" | "row";

/** The link, present or wholly absent — never half of one (NEU-1190 §1.4).
 *
 * Both fields were required, and on a presentational poster both are dead. A
 * required prop that four call sites keep passing while it does nothing is
 * what goes stale, so the pair is **jointly** optional: a `to` with no
 * `linkLabel` does not compile, and neither does its reverse.
 *
 * This is the move the component already makes for `ownRating`, which is a bare
 * number precisely so a caller *cannot* put a friend's rating in the top-right.
 * Neither `to: string | null` (which leaves `linkLabel` required and ignored)
 * nor a `presentational?: boolean` (which lets a caller state the
 * contradiction) has that property.
 */
type ShowPosterLink =
  | {
      /** The show route the poster links to. */
      to: string;
      /** Accessible name for the poster's link, used when the link holds the
       * image alone. A caption names the link itself, so it is not applied
       * over one. */
      linkLabel: string;
    }
  | { to?: never; linkLabel?: never };

/** One show poster, and **the one place a poster corner is assigned**
 * (NEU-1183 §5.1).
 *
 * **Facts on top, controls on the bottom** (§3.4):
 *
 * ```
 * ┌──────────────────────────┐
 * │ [library mark]  [own ★]  │   top     — facts
 * │          poster          │
 * │ (reserved)     [control] │   bottom  — controls
 * └──────────────────────────┘
 * ```
 *
 * top-left is the library mark, top-right the viewer's own rating, bottom-right
 * a control, bottom-left reserved for a second one. An aggregate rating goes
 * inline beside the title and another person's rating never occupies a corner
 * at all (§3.5) — which is why the only rating this component can draw is the
 * viewer's.
 *
 * **Corners are never passed in per call site.** Both marks used to move
 * between Discover and My Shows, and they traded places diagonally, so nothing
 * on a card was a stable landmark. A shared class string is not the fix — a
 * string is what drifted, twice (NEU-1057 unified the mark's *picture* the same
 * way). A new surface gets correct placement by using this component and
 * stating no position at all.
 *
 * Three things about the shape are load-bearing.
 *
 * **It owns its own `Link`.** A control overlaying the poster must be a
 * *sibling* of the link, never a descendant: a `<button>` inside an `<a>` is
 * invalid nesting and a real focus-order problem (NEU-1179 §3.2). `ShowCard`
 * kept that rule by hand, with its `<Link>` wrapping the badges while the
 * dismiss chip sat outside it. Rendering the link here makes it structural —
 * every overlay slot below is a sibling of it by construction.
 *
 * **Facts are values, controls are nodes.** `inMyShows` is a boolean and
 * `ownRating` a number, so this component constructs the badges itself. A
 * caller cannot put an arbitrary node in a fact corner and — the point — cannot
 * put a *friend's* rating in the top-right, because the prop takes a bare
 * number and is named `ownRating`. `control` stays a `ReactNode` because
 * controls genuinely vary; facts do not.
 *
 * **`size` is a variant, not a `className`.** The two real widths are the
 * card's `w-full` and the list row's `w-16`. Anything else is a new surface
 * making a decision, and it should be made here.
 *
 * It also absorbs a duplication: the poster markup existed three times with two
 * behaviours — `ShowCard` and `MyShowCard` each declared their own identical
 * `FALLBACK_POSTER`, while the two library rows rendered a `bg-muted` div for a
 * missing image instead. All four now render the same absence.
 *
 * **A card's caption goes inside the poster's link, a row's text does not.**
 * A card has always been one link over its poster and its title together, and
 * NEU-1183 was about placement — turning that into two links to one show would
 * double the tab stops on a twelve-card grid and announce every show twice. So
 * `children` is rendered inside the link, and the overlay layer mirrors the
 * image's aspect ratio to stay over the poster rather than over the caption. A
 * list row's text sits *beside* the poster and passes no caption, so its link
 * holds the image alone and `linkLabel` names it.
 *
 * **A row poster can decline the link entirely** (NEU-1190 §1.3). Four row
 * surfaces put the poster's link and their own title link side by side, both
 * named for the show and both landing on it, so a keyboard user tabbed through
 * one destination twice per row and a screen reader announced `link "1983"`
 * twice. Omitting `to`/`linkLabel` renders the image and its badges in a plain
 * wrapper instead, and the row's text is the single route to the show.
 *
 * The obvious alternative — `aria-hidden` plus `tabIndex={-1}` on the link —
 * is wrong *here specifically*: `aria-hidden` removes the whole subtree, and
 * both fact badges live inside this link deliberately, so it would delete "In
 * your My Shows" and "Your rating: 4.5 out of 5" from the accessibility tree on
 * every such row, trading one defect for a worse one. The cost of dropping the
 * link instead is that the poster is no longer a tap target on those four rows;
 * moving the badges out into the sibling overlay layer to keep it would reopen
 * the decision two paragraphs up and restructure all eleven poster surfaces to
 * buy a 64px target on four rows.
 */
export function ShowPoster({
  to,
  src,
  linkLabel,
  size,
  inMyShows = false,
  ownRating = null,
  control,
  children,
}: ShowPosterLink & {
  /** The poster image, or null for a show with none. */
  src: string | null;
  size: ShowPosterSize;
  /** Whether the show is in **the viewer's** My Shows — top-left. */
  inMyShows?: boolean;
  /** The **viewer's own** rating, five-star — top-right. Never anyone else's. */
  ownRating?: number | null;
  /** One control — bottom-right. Rendered as a sibling of the poster's link. */
  control?: ReactNode;
  /** The card's caption, rendered inside the poster's own link beneath the
   * image. A card is one link over its poster and its title together; a list
   * row's text sits beside the poster instead and passes none. */
  children?: ReactNode;
}) {
  const image = (
    <>
      <img
        src={src ?? FALLBACK_POSTER}
        alt=""
        loading="lazy"
        className={cn(
          POSTER_ASPECT,
          "w-full object-cover",
          // A card poster is full-bleed inside a wrapper that clips it; a row
          // thumb stands on its own and rounds itself.
          size === "row" && "rounded",
        )}
      />
      {/* Both fact badges live **inside** the link, where they have always
       * been. They are `<span>`s, so nesting is legal — it is a `<button>`
       * that is not — and being inside it is what keeps their `title`
       * tooltip hoverable and a tap on one still navigating to the show.
       * Their `top-1` is the image's top because the caption is below. On a
       * presentational poster they keep exactly this position and their
       * labels; only the link around them goes. */}
      {inMyShows && <InMyShowsBadge className="top-1 left-1" />}
      {ownRating != null && ownRating > 0 && (
        <RatingBadge
          kind="own"
          value={ownRating}
          className="absolute top-1 right-1 text-[10px] py-0 px-1 shadow"
        />
      )}
      {children}
    </>
  );

  return (
    <div
      // The tripwire that stops a sixth surface hand-rolling a poster: each
      // surface's own test asserts it renders through this component rather
      // than restating the corner rule.
      data-show-poster=""
      className={cn("relative", size === "card" ? "w-full" : "w-16 shrink-0")}
    >
      {to === undefined ? (
        // A plain wrapper (§1.3), keeping only `relative` — the box the fact
        // badges position against. `group` and `block` belong to the link:
        // one advertises a hover state nothing here consumes, the other is
        // an `<a>`'s display fix.
        <div className="relative">{image}</div>
      ) : (
        <Link
          to={to}
          aria-label={children ? undefined : linkLabel}
          className="group relative block"
        >
          {image}
        </Link>
      )}
      {/* A control is the one slot that must be a **sibling** of the link, so it
       * cannot use the link's box for positioning — and the wrapper's box is
       * the caption's too. Its layer therefore mirrors the image's aspect ratio
       * to cover exactly the poster, and is inert apart from the control
       * itself, so the rest of the image still clicks through to the link. */}
      {control && (
        <div className={cn("pointer-events-none absolute inset-x-0 top-0", POSTER_ASPECT)}>
          <div className="pointer-events-auto absolute right-0 bottom-0">{control}</div>
        </div>
      )}
    </div>
  );
}
