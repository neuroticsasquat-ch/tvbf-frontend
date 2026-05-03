import { useCallback, useEffect, useState } from "react";

const PREFIX = "tvbf:str:";

function read(pageKey: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + pageKey);
    if (raw !== null) return raw;
  } catch {
    // ignore
  }
  return fallback;
}

export function usePersistedString(
  pageKey: string,
  fallback: string,
): [string, (next: string) => void] {
  const [value, setValue] = useState<string>(() => read(pageKey, fallback));
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + pageKey, value);
    } catch {
      // ignore
    }
  }, [pageKey, value]);
  const set = useCallback((next: string) => setValue(next), []);
  return [value, set];
}
