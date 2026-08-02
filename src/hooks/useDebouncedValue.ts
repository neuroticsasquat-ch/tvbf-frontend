import { useEffect, useState } from "react";

/** Debounce a fast-changing value — a search box, typically.
 *
 * The first value passes through immediately: a consumer that mounts with a
 * query already in hand (the search overlay does, since it only mounts once the
 * box is non-empty) must not sit blank for the delay. Only later changes wait.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (Object.is(value, debounced)) return;
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, debounced, delayMs]);

  return debounced;
}
