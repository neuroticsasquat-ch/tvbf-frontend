import { useRef } from "react";

/** Remember that `value` has been true at least once.
 *
 * A ref rather than state: the latch never causes a render of its own — the
 * render that turns `value` false is the one that reads it.
 *
 * It is scoped to the **mount**, which is the whole of its meaning: it answers
 * "did this thing have something to show while the user was here?", not "has it
 * ever". Anything that must survive a remount has to be latched by a component
 * that outlives it and passed down — Discover's recommendations tab is exactly
 * that case (NEU-1176), because Radix unmounts an inactive `TabsContent`.
 */
export function useLatched(value: boolean): boolean {
  const latched = useRef(false);
  if (value) latched.current = true;
  return latched.current;
}
