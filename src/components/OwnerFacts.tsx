import { Fragment, type ReactNode } from "react";
import { RatingBadge } from "@/components/RatingBadge";
import type { LibraryStatus } from "@/components/home/filterTypes";
import { cn } from "@/lib/cn";
import type { RatingOwner } from "@/lib/rating";

/** How dense the group is drawn — not which surface draws it.
 *
 * `inline` is a library list row: `Jeanne: 38/46 · ★4.0 · Last watched Jun 3`.
 * `stacked` is a grid card, where the name takes its own line and the facts sit
 * beneath it. That is measured rather than chosen: at 10px inside the ~97px of
 * a `grid-cols-3` card the inline form runs ~95-100px and wraps unpredictably
 * at exactly the width that matters (NEU-1182 §6.3). */
export type OwnerFactsLayout = "inline" | "stacked";

interface Props {
  /** Whose facts these are. `{ kind: "own" }` is the viewer, and renders the
   * markup every self surface rendered before this component existed — one
   * component for both modes rather than a friend-shaped copy of a self-shaped
   * block, because that divergence is what produced the bug. */
  owner: RatingOwner;
  layout: OwnerFactsLayout;
  status: LibraryStatus;
  progress: { watched: number; aired: number } | null;
  /** The owner's rating. Self surfaces pass `null` and draw the viewer's own
   * rating where it already lives — a poster corner or the action row (§3.4);
   * only another person's rating belongs in this group (§3.5). */
  rating: number | null;
  lastWatchedAt: string | null;
}

/** One person's relationship to one show, grouped and named once.
 *
 * The status pill, the progress fraction, the rating and the last-watched date
 * are facts about **a person and a show**, and until this component they were
 * rendered loose — so on a friend's library the friend's progress read as an
 * unlabelled fact and the friend's rating was labelled "Your rating"
 * (NEU-1181). Grouping them under one name makes attribution structural rather
 * than per-fact discipline. Facts about the *show* — the upcoming-episode
 * count, the premiere year — are ownerless and stay outside it.
 *
 * **The visible name appears once and is `aria-hidden`; the attribution in the
 * accessibility tree is per-fact.** Sighted readers see `Jeanne:` once;
 * assistive technology hears "Jeanne's progress: 38 of 46" and "Jeanne last
 * watched Jun 3", so nothing is announced twice and no fact is attributed only
 * by proximity to a name several nodes away.
 *
 * **The name truncates**, on every row of a library that runs to hundreds.
 * That was written when `display_name` fell back to the account's email; NEU-1154
 * has since landed handles, and this component deliberately does **not** take
 * one. `@jeanne_briggs's rating` reads badly and disambiguates nothing — you
 * are already inside one named person's context, having opened their library
 * deliberately, so possessive prose keeps the display name and only
 * consequential copy names both (NEU-1169 D8).
 *
 * One deliberate visual change on a self surface: adjacent facts are always
 * separated by a `·`. My Shows · Active's *finished* rows were the one place
 * that separator was absent — the other branch of the same component and both
 * branches of the watched list already drew it — and one component cannot
 * render two answers to identical props.
 */
export function OwnerFacts({ owner, layout, status, progress, rating, lastWatchedAt }: Props) {
  const ownerName = owner.kind === "other" ? owner.ownerName : null;
  const facts: { key: string; node: ReactNode }[] = [];

  if (status !== null) {
    facts.push({
      key: "status",
      node: (
        <Fact
          attributed={
            ownerName &&
            (status === "finished"
              ? `${ownerName} has finished this show`
              : `${ownerName} is caught up`)
          }
          // The pill keeps each surface's own spacing: a list row's `px-1.5`,
          // and on a card the `px-1` plus the extra 2px of top margin that the
          // grid's finished rows carried before this component owned the fact.
          className={cn(
            "rounded border border-emerald-600 text-emerald-700 py-0.5",
            layout === "inline" ? "px-1.5" : "mt-0.5 px-1",
          )}
        >
          {status === "finished" ? "Finished" : "Caught Up"}
        </Fact>
      ),
    });
  } else if (progress !== null) {
    facts.push({
      key: "progress",
      node: (
        <Fact
          attributed={
            ownerName && `${ownerName}'s progress: ${progress.watched} of ${progress.aired}`
          }
        >
          {ownerName
            ? `${progress.watched}/${progress.aired}`
            : `Progress: ${progress.watched}/${progress.aired}`}
        </Fact>
      ),
    });
  }

  if (rating != null && rating > 0) {
    facts.push({
      key: "rating",
      node: (
        <RatingBadge
          {...owner}
          value={rating}
          // A card's group is 10px type inside ~97px; the chip's default 12px is
          // the one element §6.3's "~30px over ~60px and fits" measurement
          // assumed away. Same size the card's own corner chip already uses.
          className={layout === "stacked" ? "text-[10px] px-1 py-0" : undefined}
        />
      ),
    });
  }

  const watchedOn = formatWatchDate(lastWatchedAt);
  if (watchedOn) {
    facts.push({
      key: "last-watched",
      node: (
        <Fact
          attributed={ownerName && `${ownerName} last watched ${watchedOn}`}
          className="whitespace-nowrap"
        >
          {ownerName ? `Last watched ${watchedOn}` : `Last Watched: ${watchedOn}`}
        </Fact>
      ),
    });
  }

  if (facts.length === 0) return null;

  const row = (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground",
        layout === "inline" ? "text-xs" : "mt-0.5 text-[10px] leading-tight",
      )}
    >
      {ownerName && layout === "inline" && (
        <span aria-hidden className="max-w-[12rem] truncate font-medium">
          {ownerName}:
        </span>
      )}
      {facts.map(({ key, node }, i) => (
        <Fragment key={key}>
          {i > 0 && (
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
          )}
          {node}
        </Fragment>
      ))}
    </div>
  );

  if (!ownerName || layout === "inline") return row;

  return (
    <div>
      <p aria-hidden className="mt-0.5 truncate text-[10px] font-medium leading-tight">
        {ownerName}:
      </p>
      {row}
    </div>
  );
}

/** One fact, visible once and announced once.
 *
 * A falsy `attributed` is self mode — falsy rather than `=== null`, because a
 * `display_name` that is the empty string would otherwise hand the tree an
 * empty `sr-only` label beside `aria-hidden` text, which is the one state where
 * a fact disappears from assistive technology entirely. Self mode is: the text is its own accessible name, and
 * the markup is what the surfaces rendered before this component. A name turns
 * the visible text into decoration and hands the accessibility tree a whole
 * attributed sentence instead — rather than an sr-only label beside visible
 * text that names *and* describes it with the same words, the failure
 * `ShowCard.tsx:117-120` already records for the library mark. */
function Fact({
  children,
  attributed,
  className,
}: {
  children: ReactNode;
  attributed: string | null;
  className?: string;
}) {
  if (!attributed) return <span className={className}>{children}</span>;
  return (
    <span className={className}>
      <span aria-hidden>{children}</span>
      <span className="sr-only">{attributed}</span>
    </span>
  );
}

/** The last-watched date, in the format both library lists formatted it in
 * before this component took the fact over: month and day, plus the year once
 * the date is old enough that the year stops being obvious. */
function formatWatchDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  const ageDays = (Date.now() - d.getTime()) / 86_400_000;
  const includeYear = ageDays > 180;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}
