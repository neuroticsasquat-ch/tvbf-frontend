import { useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { useMuteShow } from "@/api/me";
import { Button } from "@/components/ui/button";

/** The per-show push-notification mute toggle (NEU-1495, push project spec
 * §6.5) — one show's pushes, every kind, on or off.
 *
 * It sits in the **action row**, never over the poster: NEU-1187 §3.1 reserves
 * the poster's corners for a control that can only remove, and this one flips
 * both ways. The two variants follow `MyShowsButton`'s: `labelled` is the list
 * row's chip, `compact` the icon-only form for a ~97px grid card.
 *
 * **It takes the answer, not the sources** — `muted` comes from the caller's
 * `MyShowEntry`, and the optimistic `override` / `lastUpstream` reconciliation
 * is `MyShowsButton`'s, so a failed request puts the glyph back rather than
 * leaving a guess on screen. `useMuteShow` patches `["my-shows"]` as well, so
 * the other view agrees before the refetch lands.
 *
 * **The glyph is the current state, the words are the action**: `Bell` while
 * notifications are on, `BellOff` once muted, and the accessible name says what
 * a click will do. That name carries the show's name in both variants, for
 * `MyShowsButton`'s reason — a list of identical "Mute" buttons is
 * unnavigable, and the compact one has no visible text at all.
 *
 * Only a surface drawn from the **viewer's own** library may render it: a
 * friend's entry carries the friend's flags, and this would PATCH the viewer's
 * row for a show the viewer may not track (a 404). The callers enforce that the
 * way they enforce `removable`, on `ratingOwner.kind === "own"`.
 */
export function MuteShowButton({
  showId,
  showName,
  muted,
  variant = "labelled",
}: {
  showId: number;
  /** The show's name, for the accessible name of either variant. */
  showName: string;
  muted: boolean;
  variant?: "labelled" | "compact";
}) {
  const mute = useMuteShow(showId);

  const [override, setOverride] = useState<boolean | null>(null);
  const [lastUpstream, setLastUpstream] = useState(muted);
  // Upstream truth moving is what clears a stale override (`MyShowsButton`).
  if (lastUpstream !== muted) {
    setLastUpstream(muted);
    setOverride(null);
  }
  const isMuted = override ?? muted;

  function onToggle() {
    const next = !isMuted;
    setOverride(next);
    mute.mutate(next, { onError: () => setOverride(!next) });
  }

  const label = isMuted
    ? `Unmute notifications for ${showName}`
    : `Mute notifications for ${showName}`;
  const Glyph = isMuted ? BellOff : Bell;

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={mute.isPending}
        aria-label={label}
        title={isMuted ? "Unmute notifications" : "Mute notifications"}
        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <Glyph className="h-3.5 w-3.5" aria-hidden />
      </button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onToggle}
      disabled={mute.isPending}
      aria-label={label}
      className="h-7 px-2 gap-1 text-xs text-muted-foreground"
    >
      <Glyph className="h-3.5 w-3.5" aria-hidden />
      {isMuted ? "Unmute" : "Mute"}
    </Button>
  );
}
