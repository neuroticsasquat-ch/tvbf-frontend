import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  currentSubscription,
  registerSubscription,
  subscribe,
  supportState,
  unsubscribe,
  type PushSupportState,
} from "@/lib/push";
import { ApiError, apiFetch } from "./client";

export interface PushSubscriptionSummary {
  id: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
}

/** `POST /me/push/test`'s 202 body: the outcome, not a bare accepted (§5.4). */
export interface PushTestResult {
  status: "sent" | "failed";
  status_code: number | null;
}

/** This browser's side of push: where it stands and whether it holds a live
 * subscription. Browser state, not server state, so it has its own key. */
export interface PushDeviceState {
  state: PushSupportState;
  subscribed: boolean;
}

const MY_SUBSCRIPTIONS_KEY = ["me-push-subscriptions"];
const DEVICE_KEY = ["push-device"];

export const fetchVapidKey = () =>
  apiFetch<{ public_key: string }>("/push/vapid-public-key").then((r) => r.public_key);

/** The server's VAPID public key — fetched, never hard-coded (§7). A 503 means
 * the server is not configured for push, and there is nothing to retry. */
export function useVapidKey(enabled = true) {
  return useQuery({
    queryKey: ["push-vapid-key"],
    queryFn: fetchVapidKey,
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

export const fetchMyPushSubscriptions = () =>
  apiFetch<PushSubscriptionSummary[]>("/me/push/subscriptions");

export function useMyPushSubscriptions(enabled = true) {
  return useQuery({
    queryKey: MY_SUBSCRIPTIONS_KEY,
    queryFn: fetchMyPushSubscriptions,
    enabled,
  });
}

export function usePushDevice() {
  return useQuery<PushDeviceState>({
    queryKey: DEVICE_KEY,
    queryFn: async () => {
      const state = supportState();
      const subscribed = state === "granted" && (await currentSubscription()) !== null;
      return { state, subscribed };
    },
  });
}

function invalidatePush(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: DEVICE_KEY });
  qc.invalidateQueries({ queryKey: MY_SUBSCRIPTIONS_KEY });
}

/** Turn notifications on for this device.
 *
 * Deliberately **not** a `useMutation`: `mutate` awaits its lifecycle hooks
 * before calling the mutation function, and each of those yields spends a
 * little of the click's user activation. `run` calls `subscribe` in the same
 * tick as the click, so `requestPermission()` sees the gesture. */
export function useSubscribePush() {
  const qc = useQueryClient();
  const [isPending, setPending] = useState(false);
  const run = useCallback(
    async (applicationServerKey: string) => {
      setPending(true);
      try {
        return await subscribe(applicationServerKey);
      } finally {
        setPending(false);
        invalidatePush(qc);
      }
    },
    [qc],
  );
  return { subscribe: run, isPending };
}

export function useUnsubscribePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unsubscribe,
    onSettled: () => invalidatePush(qc),
  });
}

/** Send a test push to this device.
 *
 * A 410 means the push service has retired the subscription and the server
 * has deleted its row, so the local one is dead too: drop it, and the state
 * line refetches to "Turn on notifications". */
export function useSendTestPush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const subscription = await currentSubscription();
      if (!subscription) throw new Error("This device has no push subscription");
      const id = await registerSubscription(subscription);
      return apiFetch<PushTestResult>("/me/push/test", {
        method: "POST",
        body: JSON.stringify({ subscription_id: id }),
      });
    },
    onError: async (e) => {
      if (!(e instanceof ApiError && e.status === 410)) return;
      try {
        await (await currentSubscription())?.unsubscribe();
      } catch {
        // Already dead on the push service's side; nothing more to undo.
      }
      invalidatePush(qc);
    },
  });
}
