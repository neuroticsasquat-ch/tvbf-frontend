import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { GenreOut, NetworkOut } from "./types";

const HOUR = 60 * 60 * 1000;

export function useGenres() {
  return useQuery<GenreOut[]>({
    queryKey: ["genres"],
    queryFn: () => apiFetch<GenreOut[]>("/genres"),
    staleTime: HOUR,
  });
}

export function useNetworks() {
  return useQuery<NetworkOut[]>({
    queryKey: ["networks"],
    queryFn: () => apiFetch<NetworkOut[]>("/networks"),
    staleTime: HOUR,
  });
}
