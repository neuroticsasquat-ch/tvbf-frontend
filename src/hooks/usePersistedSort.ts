import { useCallback, useEffect, useState } from "react";

const PREFIX = "tvbf:sort:";

function read<T extends string>(pageKey: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + pageKey);
    if (raw && (allowed as readonly string[]).includes(raw)) return raw as T;
  } catch {
    // localStorage may throw in private mode / disabled storage
  }
  return fallback;
}

export function usePersistedSort<T extends string>(
  pageKey: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => read(pageKey, allowed, fallback));

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + pageKey, value);
    } catch {
      // ignore write failures
    }
  }, [pageKey, value]);

  const set = useCallback((next: T) => setValue(next), []);
  return [value, set];
}
