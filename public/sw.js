// TV BingeFriend service worker (NEU-1483).
//
// Hand-written and served as-is from `public/`, so it gets root scope with no
// build step: no vite-plugin-pwa, no Workbox, no caches and no `fetch`
// handler — offline is out of scope (push-notifications project spec §2, §6.1).
// It exists for Web Push alone. The handlers are attached to `self` so
// `src/sw.test.ts` can drive them directly over fake event objects.

"use strict";

// `sw.js` cannot read Vite's env, so `src/lib/serviceWorker.ts` passes the API
// base on the registration URL. Absent, the worker makes no requests at all.
const API_BASE = new URL(self.location.href).searchParams.get("api");

/** The §5.3 payload, or null when the push is not one this worker can show. */
function readPayload(event) {
  let payload;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.key !== "string" ||
    typeof payload.title !== "string" ||
    typeof payload.url !== "string"
  ) {
    return null;
  }
  return payload;
}

/** An absolute URL on this origin. The payload's `url` is SPA-relative (§5.3);
 * anything that resolves off-origin opens the app root instead. */
function appUrl(path) {
  const origin = self.location.origin;
  const url = new URL(typeof path === "string" ? path : "/", origin);
  return url.origin === origin ? url.href : `${origin}/`;
}

self.handlePush = async (event) => {
  const payload = readPayload(event);
  // Malformed pushes are ignored, not thrown: a throw here surfaces nothing
  // useful to the user and the server has no way to hear about it.
  if (!payload) return;
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    // `tag` = the notification key, so a re-send replaces rather than stacks (Q8).
    tag: payload.key,
    data: { url: payload.url },
  };
  if (typeof payload.icon === "string") options.icon = payload.icon;
  await self.registration.showNotification(payload.title, options);
};

self.handleNotificationClick = async (event) => {
  event.notification.close();
  const target = appUrl(event.notification.data && event.notification.data.url);
  // Controlled clients only: `navigate` rejects on a window this worker does
  // not control, and `activate` claims every open one.
  const windows = await self.clients.matchAll({ type: "window" });
  const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
  if (existing) {
    // Focus first, while the click's user activation is still live.
    await existing.focus();
    await existing.navigate(target);
    return;
  }
  await self.clients.openWindow(target);
};

self.handlePushSubscriptionChange = async (event) => {
  // Best-effort by design (§6.1): the push service has already rotated the
  // subscription, and if this fails the old row is retired server-side on its
  // next 404/410 while the user can re-subscribe from Settings.
  try {
    const key = event.oldSubscription && event.oldSubscription.options.applicationServerKey;
    if (!API_BASE || !key) return;
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
    // The POST needs the double-submit CSRF token, and a worker cannot read
    // cookies, so it asks the session for it the way the SPA does at boot.
    const me = await fetch(`${API_BASE}/me`, { credentials: "include" });
    if (!me.ok) return;
    const { csrf_token: csrfToken } = await me.json();
    const { endpoint, keys } = subscription.toJSON();
    await fetch(`${API_BASE}/me/push/subscriptions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ endpoint, keys }),
    });
  } catch (err) {
    console.warn("Push re-subscription failed", err);
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(self.handlePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.waitUntil(self.handleNotificationClick(event));
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(self.handlePushSubscriptionChange(event));
});
