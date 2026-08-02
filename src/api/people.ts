import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { PersonCredits, PersonOut } from "./types";

const FIVE_MINUTES = 5 * 60 * 1000;

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
