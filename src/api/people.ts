import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { PersonCredits, PersonListPage, PersonOut } from "./types";

const FIVE_MINUTES = 5 * 60 * 1000;

/** Person search — a separate entity search, never folded into show search.
 *
 * `signal` is threaded through so a superseded keystroke's request is actually
 * aborted rather than left in flight; the shows query does the same, and both
 * share one debounce upstream in `SearchOverlay`. */
export function usePersonSearch(
  search: string,
  options: { page?: number; per_page?: number; enabled?: boolean } = {},
) {
  const { page = 1, per_page = 24, enabled = true } = options;
  const params = new URLSearchParams({
    search,
    page: String(page),
    per_page: String(per_page),
  });
  return useQuery<PersonListPage>({
    queryKey: ["people", search, page, per_page],
    queryFn: ({ signal }) => apiFetch<PersonListPage>(`/people?${params.toString()}`, { signal }),
    staleTime: FIVE_MINUTES,
    enabled: enabled && search.length > 0,
  });
}

export function usePerson(id: number) {
  return useQuery<PersonOut>({
    queryKey: ["person", id],
    queryFn: () => apiFetch<PersonOut>(`/people/${id}`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Filmography, grouped into cast/crew/guest by the API. Each group arrives in
 * a deliberate order — cast and crew by show premiere date descending, guest
 * credits by air date descending — so never re-sort it client-side. */
export function usePersonCredits(id: number) {
  return useQuery<PersonCredits>({
    queryKey: ["person-credits", id],
    queryFn: () => apiFetch<PersonCredits>(`/people/${id}/credits`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}
