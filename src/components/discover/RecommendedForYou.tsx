import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRecommendations } from "@/api/me";
import { ShowGrid } from "@/components/ShowGrid";
import { useLatched } from "@/hooks/useLatched";

/** The "My Recommendations" tab of the Discover page (NEU-1114).
 *
 * Renders nothing at all when there has never been anything to show — no empty
 * state, no "add more shows" nudge, no spinner, no error. That covers a user
 * whose set has never been generated, one below the generation floor, one whose
 * Sunday run failed, and a request that failed outright, all identically: an
 * empty-state panel explaining an absent feature costs a real moment of "why is
 * this broken?" while advertising machinery nobody asked about (project spec
 * §11). `DiscoverPage` applies the same rule one level up and withholds the
 * tab itself, so this panel is normally unreachable when it is empty. A list
 * that empties *under* a reader who had rows is the one case that says
 * something, and it is the last paragraph below.
 *
 * The label is "My Recommendations", not "Because you watched" — the latter
 * promises a per-show causal link the reason does not deliver, since the model
 * reasons over the whole profile.
 *
 * There is no sort control, no filter and no pagination: the ranking is the
 * model's, and letting users re-sort discards the only ordering that carries
 * information. The list is rendered exactly as the server sent it — the cap and
 * the `adult` / `deleted_upstream_at` filters are the server's (NEU-1112
 * contract §4). It legitimately shrinks as the user acts on it: the server
 * suppresses a suggestion once the viewer has a record for that show
 * (NEU-1175), and the stored set is never backfilled from an older one.
 *
 * **The one-line sign-off is mount-scoped, and is not the empty state §11
 * forbids.** That rule is about a user meeting machinery they have never had,
 * where an explanation costs a real moment of "why is this broken?". This line
 * is reachable only by a user who just used up every suggestion they were
 * given in this very mount, and it explains something they spent. Every cold
 * path — never generated, below the floor, a failed Sunday run, a failed
 * request — still renders nothing at all, and `DiscoverPage` still withholds
 * the tab for them. "Sunday" is accurate: the weekly pass is a Coolify
 * scheduled task running Sundays.
 *
 * `everHadRows` is that latch taken one level up. Radix unmounts an inactive
 * `TabsContent`, so a latch held only here is lost on a tab switch and this
 * pane would render nothing under a tab `DiscoverPage` is still showing — the
 * blank the latch exists to prevent, one interaction later. The page owns the
 * durable answer and hands it down; the local latch remains for a caller that
 * renders this panel on its own. It covers a dismissal for free, because it
 * latches on *had rows* rather than on why they went away.
 *
 * **This panel owns where focus goes after a dismissal** (NEU-1179 §3.4).
 * There is no optimistic removal — the replacement is the server's choice from
 * the stored set and the client cannot know it — so the sequence is: activate
 * the chip, `POST`, invalidate, refetch, the row leaves the array, the card
 * unmounts, and focus falls to `<body>`. From there a keyboard or
 * screen-reader user is ~25 tab stops from where they were, on the one action
 * this surface expects to be repeated.
 *
 * **The absence gate is the part that is easy to get wrong.** `onSuccess`
 * fires *before* the refetch resolves, so an effect running on the callback
 * alone would focus the card that is about to unmount. The effect therefore
 * waits until the dismissed id has actually left the list, which is also what
 * keeps it correct when the refetch is slow or the list changed meanwhile. It
 * then focuses the chip that shifted up into the freed slot — clamped to the
 * last chip when the dismissed card was the last one — or the sign-off line
 * when none remain, so what a reader hears is the line explaining what they
 * just spent.
 *
 * Reaching into the rendered card by `data-dismiss-recommendation` is a real
 * coupling, chosen over forwarding refs through `ShowGrid` and `ShowCard` —
 * three levels of plumbing across components shared by five surfaces that need
 * none of it, plus a ref collection keyed by index that has to survive the
 * array changing under it. The attribute is what makes the coupling explicit
 * rather than incidental. No `aria-live`: moving focus to a chip whose
 * accessible name is "Don't recommend {next show} again" already announces the
 * new context, and a live region would double-speak it.
 */
export function RecommendedForYou({ everHadRows = false }: { everHadRows?: boolean } = {}) {
  const { data } = useRecommendations();
  const recommendations = useMemo(() => data?.recommendations ?? [], [data]);
  const hadRows = useLatched(recommendations.length > 0) || everHadRows;

  const sectionRef = useRef<HTMLElement>(null);
  // The dismissed show and where it sat when it was dismissed. Held as state
  // rather than a ref so the effect below re-runs when it is recorded.
  const [dismissed, setDismissed] = useState<{ showId: number; index: number } | null>(null);

  // One reference for every card, per §3.3 — the card hands its own id back,
  // so nothing here is per-row.
  const onDismissed = useCallback(
    (showId: number) => {
      const index = recommendations.findIndex((r) => r.id === showId);
      setDismissed({ showId, index: index < 0 ? 0 : index });
    },
    [recommendations],
  );

  useEffect(() => {
    if (!dismissed) return;
    // The absence gate: wait for the refetch to actually drop the row, or we
    // focus the card that is about to unmount.
    if (recommendations.some((r) => r.id === dismissed.showId)) return;
    const root = sectionRef.current;
    setDismissed(null);
    if (!root) return;
    const chips = root.querySelectorAll<HTMLElement>("[data-dismiss-recommendation]");
    if (chips.length > 0) {
      chips[Math.min(dismissed.index, chips.length - 1)].focus();
      return;
    }
    root.querySelector<HTMLElement>("[data-recommendations-signoff]")?.focus();
  }, [dismissed, recommendations]);

  if (recommendations.length === 0) {
    if (!hadRows) return null;
    return (
      <section
        ref={sectionRef}
        aria-labelledby="my-recommendations-heading"
        className="flex flex-col gap-2"
      >
        <h2 id="my-recommendations-heading" className="sr-only">
          My Recommendations
        </h2>
        {/* `tabIndex={-1}` so the focus move has somewhere to land when the
          last suggestion goes; it is not in the tab order. */}
        <p className="text-muted-foreground" data-recommendations-signoff tabIndex={-1}>
          That&rsquo;s everything for this week &mdash; new recommendations on Sunday.
        </p>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="my-recommendations-heading"
      className="flex flex-col gap-2"
    >
      {/* The tab label carries the visible title; this stays for the document
        outline and screen readers, matching Trending and Most Anticipated. */}
      <h2 id="my-recommendations-heading" className="sr-only">
        My Recommendations
      </h2>
      {/* The one surface that passes `addable` — and, since NEU-1179, the one
        surface that passes `dismissible`: making the grid a place a suggestion
        can be acted on is the shortest path between seeing one and taking it,
        and removing one for good is the other half of the same idea. Every
        other grid passes nothing and renders neither control. */}
      <ShowGrid shows={recommendations} addable dismissible onDismissed={onDismissed} />
    </section>
  );
}
