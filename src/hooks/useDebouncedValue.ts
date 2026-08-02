import { useEffect, useState } from "react";

/** Debounce a fast-changing value — a search box, typically.
 *
 * `initialValue` is what the hook reports until the first delay elapses, and it
 * is what makes the *first* change debounced like every other one. A consumer
 * that mounts the moment typing starts (the search overlay mounts on character
 * one) would otherwise fire one un-debounced request per search session: pass
 * an empty query here and that request never happens.
 */
export function useDebouncedValue<T>(value: T, delayMs: number, initialValue: T): T {
  const [debounced, setDebounced] = useState(initialValue);

  useEffect(() => {
    if (Object.is(value, debounced)) return;
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, debounced, delayMs]);

  return debounced;
}
