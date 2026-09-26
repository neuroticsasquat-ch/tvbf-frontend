import { apiFetch } from "@/api/client";

/** Where this browser stands on Web Push (push-notifications project spec
 * §6.2). The Settings Notifications section renders one state line per value
 * (§6.3). */
export type PushSupportState = "unsupported" | "ios_needs_install" | "denied" | "prompt" | "granted";

/** iPhone, iPod or iPad — including the iPadOS default of a desktop Mac user
 * agent, which only a touch-capable "Mac" gives away. */
function isIos(): boolean {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

/** Read-only and synchronous: it never asks for permission.
 *
 * The iOS check runs **first**. Safari only exposes `PushManager` to an app
 * opened from the Home Screen, so in a tab it would otherwise read as
 * `unsupported` — true, but the useful answer is "install it first". An
 * installed iOS older than 16.4 still lacks the API and falls through to
 * `unsupported`. */
export function supportState(): PushSupportState {
  if (isIos() && (navigator as Navigator & { standalone?: boolean }).standalone !== true) {
    return "ios_needs_install";
  }
  if (
    !("serviceWorker" in navigator) ||
    typeof window.PushManager === "undefined" ||
    typeof window.Notification === "undefined"
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  return "prompt";
}

/** The VAPID key arrives base64url-encoded (§5.4); `PushManager.subscribe`
 * wants the raw bytes. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** This browser's live subscription, or null.
 *
 * `getRegistration()` rather than `serviceWorker.ready`: `ready` never settles
 * when registration failed, and a state line waiting on it would spin forever
 * where "not subscribed" is the truth. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || typeof window.PushManager === "undefined") return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Register a subscription with the server and learn its id.
 *
 * `POST /me/push/subscriptions` upserts on the endpoint and answers `{id}`
 * either way, so this doubles as "which row is this device?": `GET` never
 * returns endpoints, so the server's list cannot say, and a locally stored id
 * goes stale the moment the worker's `pushsubscriptionchange` re-registers
 * under a new endpoint. Only ever called from a user's action. */
export async function registerSubscription(subscription: PushSubscription): Promise<string> {
  const { id } = await apiFetch<{ id: string }>("/me/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  });
  return id;
}

/** Thrown by `subscribe()` when the user did not grant permission. Not a
 * failure to report: the state line already says what happened. */
export class PushPermissionError extends Error {
  readonly permission: NotificationPermission;

  constructor(permission: NotificationPermission) {
    super(`Notification permission ${permission}`);
    this.name = "PushPermissionError";
    this.permission = permission;
  }
}

/** Ask for permission, subscribe this browser, register it; resolves to the
 * server's id.
 *
 * **Call this only from a click handler, and synchronously within it** (Q14).
 * `requestPermission()` is the first thing it does, before any `await`, so
 * the browser still sees the user's gesture — Safari refuses the prompt
 * without one. That is also why the key is a parameter rather than fetched
 * here: a fetch ahead of the prompt would spend the gesture. */
export async function subscribe(applicationServerKey: string): Promise<string> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushPermissionError(permission);
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
  });
  return registerSubscription(subscription);
}

/** Turn this device off: the local subscription first, so nothing reaches the
 * browser even if the server call fails, then its row. */
export async function unsubscribe(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  const id = await registerSubscription(subscription);
  await subscription.unsubscribe();
  await apiFetch<void>(`/me/push/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
}
