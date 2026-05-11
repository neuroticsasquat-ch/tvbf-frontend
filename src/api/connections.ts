import { apiFetch } from "./client";
import type {
  BlockedUserOut,
  ConnectionOut,
  ConnectionRequestList,
  ConnectionRequestOut,
  UserSearchResult,
} from "./types";

// User search ----------------------------------------------------------------

export function searchUsers(q: string): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ q });
  return apiFetch<UserSearchResult[]>(`/users/search?${params.toString()}`);
}

// Connection requests --------------------------------------------------------

export function listConnectionRequests(): Promise<ConnectionRequestList> {
  return apiFetch<ConnectionRequestList>("/me/connection-requests");
}

export function sendConnectionRequest(addresseeId: string): Promise<ConnectionRequestOut> {
  return apiFetch<ConnectionRequestOut>("/connection-requests", {
    method: "POST",
    body: JSON.stringify({ addressee_id: addresseeId }),
  });
}

export function acceptConnectionRequest(id: string): Promise<ConnectionRequestOut> {
  return apiFetch<ConnectionRequestOut>(`/connection-requests/${id}/accept`, { method: "POST" });
}

export function deleteConnectionRequest(id: string): Promise<void> {
  return apiFetch<void>(`/connection-requests/${id}`, { method: "DELETE" });
}

// Connections ---------------------------------------------------------------

export function listConnections(): Promise<ConnectionOut[]> {
  return apiFetch<ConnectionOut[]>("/me/connections");
}

export function removeConnection(userId: string): Promise<void> {
  return apiFetch<void>(`/me/connections/${userId}`, { method: "DELETE" });
}

// Blocks --------------------------------------------------------------------

export function listBlocks(): Promise<BlockedUserOut[]> {
  return apiFetch<BlockedUserOut[]>("/me/blocks");
}

export function blockUser(userId: string): Promise<BlockedUserOut> {
  return apiFetch<BlockedUserOut>(`/me/blocks/${userId}`, { method: "POST" });
}

export function unblockUser(userId: string): Promise<void> {
  return apiFetch<void>(`/me/blocks/${userId}`, { method: "DELETE" });
}
