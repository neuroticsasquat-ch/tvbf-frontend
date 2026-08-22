import { useCallback, useEffect, useRef, useState } from "react";

/** Where focus goes after a control removes the thing it was sitting on
 * (NEU-1193).
 *
 * Three surfaces render a list of cards or rows, each carrying a control that
 * removes its own item, and on all three the item unmounts while that control
 * still holds focus — so focus falls to `<body>` and a keyboard or
 * screen-reader user is tens of tab stops from where they were, on the one
 * action each of those surfaces expects to be repeated. `RecommendedForYou`
 * fixed it first (NEU-1179 §3.4), `LibraryActiveList` copied it (NEU-1187
 * §3.5), and `LibraryWatchedList` is the third — the threshold this codebase
 * repeatedly names as the point to extract rather than copy again (NEU-1057's
 * three library marks, NEU-1176's two copies of the optimistic
 * reconciliation).
 *
 * **The absence gate is the part that is easy to get wrong, and is the reason
 * this is a hook rather than a shared helper.** A removal is reported by the
 * control's `onSuccess`, which fires *before* the surface has settled on its
 * new list — immediately so for an optimistic mutation, one refetch later for a
 * mutation that has none. An effect running on the callback alone therefore
 * focuses the card that is about to unmount. This one records the removal and
 * then waits until that key has actually left `items`, which is also what keeps
 * it correct when a refetch is slow or the list changed for some other reason
 * meanwhile.
 *
 * The other two behaviours it preserves: the freed slot's index is **clamped**
 * to the last control, so removing the last item lands on the new last one
 * rather than nowhere; and when nothing remains, focus goes to `emptySelector`
 * inside the container if one is given and to the container itself otherwise —
 * which is why every caller's container carries `tabIndex={-1}`.
 *
 * `selector` reaches into the rendered card or row by `data-` attribute rather
 * than through three levels of ref forwarding across components shared by
 * surfaces that need none of it. That coupling is deliberate and stays
 * (NEU-1179 §3.5, NEU-1187 §3.5); the attribute is what makes it explicit
 * rather than incidental.
 *
 * `keyOf` belongs at module scope in the calling file — it lands in this
 * hook's effect dependencies, so an inline arrow re-runs the effect on every
 * render. The effect is guarded and that is harmless, but a stable function
 * costs nothing.
 *
 * The element type is a parameter because the containers differ — a `<section>`
 * on Discover, a `<div>` on the library tabs — and a `RefObject` is invariant,
 * so one `HTMLElement` ref could not be handed to `<div ref={…}>`.
 */
export function useFocusAfterRemoval<T, E extends HTMLElement = HTMLElement>(
  /** The list as the surface currently renders it — filtered and sorted, not
   * the raw payload, since the freed slot is a position in what was on screen. */
  items: readonly T[] | undefined,
  /** The identity `onRemoved` reports back. Keep it stable; see above. */
  keyOf: (item: T) => number,
  /** CSS selector for the per-item controls, queried within the container. */
  selector: string,
  /** Optional selector for what takes focus when no items remain. Without one,
   * the container itself takes it. */
  emptySelector?: string,
) {
  const containerRef = useRef<E>(null);
  // The removed key and where it sat when it went. State rather than a ref, so
  // recording it re-runs the effect below.
  const [removed, setRemoved] = useState<{ key: number; index: number } | null>(null);

  // One reference for every card and row; the control hands its own key back,
  // so nothing here is per-item.
  const onRemoved = useCallback(
    (key: number) => {
      const index = items?.findIndex((item) => keyOf(item) === key) ?? -1;
      setRemoved({ key, index: index < 0 ? 0 : index });
    },
    [items, keyOf],
  );

  useEffect(() => {
    if (!removed) return;
    // The absence gate.
    if (items?.some((item) => keyOf(item) === removed.key)) return;
    const root = containerRef.current;
    setRemoved(null);
    if (!root) return;
    const controls = root.querySelectorAll<HTMLElement>(selector);
    if (controls.length > 0) {
      controls[Math.min(removed.index, controls.length - 1)].focus();
      return;
    }
    // A caller that named an empty target gets that one or nothing — never the
    // container, which on Discover is a `<section>` nothing can focus anyway.
    // A caller that named none gets the container, which is why theirs carries
    // `tabIndex={-1}`.
    const fallback = emptySelector ? root.querySelector<HTMLElement>(emptySelector) : root;
    fallback?.focus();
  }, [removed, items, keyOf, selector, emptySelector]);

  return { containerRef, onRemoved };
}
