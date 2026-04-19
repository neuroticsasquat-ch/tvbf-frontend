import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { ALL_SORT_KEYS, type ShowFilters, type SortKey } from "@/api/types";

function parseSort(value: string | null): SortKey | undefined {
  if (!value) return undefined;
  return (ALL_SORT_KEYS as readonly string[]).includes(value) ? (value as SortKey) : undefined;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function paramsToFilters(params: URLSearchParams): ShowFilters {
  return {
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
    language: params.get("language") ?? undefined,
    type: params.get("type") ?? undefined,
    sort: parseSort(params.get("sort")),
    page: parsePositiveInt(params.get("page")),
    per_page: parsePositiveInt(params.get("per_page")),
    genre: params.getAll("genre").filter((g) => g.length > 0),
    network: params
      .getAll("network")
      .map((n) => Number.parseInt(n, 10))
      .filter((n) => Number.isFinite(n)),
  };
}

export function useShowFiltersUrlState(): [
  ShowFilters,
  (next: Partial<ShowFilters>, options?: { replacePage?: boolean }) => void,
] {
  const [params, setParams] = useSearchParams();

  const filters = paramsToFilters(params);

  const setFilters = useCallback(
    (next: Partial<ShowFilters>, options?: { replacePage?: boolean }) => {
      const current = paramsToFilters(params);
      const isReset = Object.keys(next).length === 0;
      const merged: ShowFilters = isReset ? {} : { ...current, ...next };
      const changedNonPage =
        isReset || Object.keys(next).some((k) => k !== "page" && k !== "per_page");
      const resetPage =
        changedNonPage && next.page === undefined && options?.replacePage !== false;
      if (resetPage) merged.page = 1;

      const out = new URLSearchParams();
      if (merged.search) out.set("search", merged.search);
      if (merged.status) out.set("status", merged.status);
      if (merged.language) out.set("language", merged.language);
      if (merged.type) out.set("type", merged.type);
      if (merged.sort) out.set("sort", merged.sort);
      if (merged.page !== undefined && merged.page !== 1) out.set("page", String(merged.page));
      if (merged.per_page !== undefined) out.set("per_page", String(merged.per_page));
      for (const g of merged.genre ?? []) if (g) out.append("genre", g);
      for (const n of merged.network ?? []) out.append("network", String(n));
      setParams(out, { replace: false });
    },
    [params, setParams],
  );

  return [filters, setFilters];
}
