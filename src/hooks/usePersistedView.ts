import { useCallback, useEffect, useState } from "react";
import type { ViewMode } from "@/components/ViewToggle";

const PREFIX = "tvbf:view:";
const ALLOWED: readonly ViewMode[] = ["list", "grid"];

function read(pageKey: string, fallback: ViewMode): ViewMode {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + pageKey);
    if (raw && (ALLOWED as readonly string[]).includes(raw)) return raw as ViewMode;
  } catch {
    // ignore
  }
  return fallback;
}

export function usePersistedView(
  pageKey: string,
  fallback: ViewMode = "list",
): [ViewMode, (next: ViewMode) => void] {
  const [value, setValue] = useState<ViewMode>(() => read(pageKey, fallback));
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + pageKey, value);
    } catch {
      // ignore
    }
  }, [pageKey, value]);
  const set = useCallback((next: ViewMode) => setValue(next), []);
  return [value, set];
}
