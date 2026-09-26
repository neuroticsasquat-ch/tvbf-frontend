import swSource from "../public/sw.js?raw";

// `public/sw.js` is hand-written and served as-is (NEU-1483), so it is tested
// as source: evaluated against a fake `self` and `fetch`, with its handlers
// driven directly over hand-built event objects. Nothing leaks into the jsdom
// globals, and no real service-worker runtime is needed.

const ORIGIN = "https://app.example";
const API = "https://api.example";

type Listener = (event: unknown) => void;

function loadWorker({ api = API }: { api?: string | null } = {}) {
  const listeners: Record<string, Listener> = {};
  const scriptUrl = new URL("/sw.js", ORIGIN);
  if (api !== null) scriptUrl.searchParams.set("api", api);
  const self = {
    location: scriptUrl,
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: {
      claim: vi.fn(() => Promise.resolve()),
      matchAll: vi.fn(async (): Promise<unknown[]> => []),
      openWindow: vi.fn(async () => null),
    },
    registration: {
      showNotification: vi.fn(() => Promise.resolve()),
      pushManager: { subscribe: vi.fn() },
    },
  } as Record<string, unknown> & {
    skipWaiting: ReturnType<typeof vi.fn>;
    clients: Record<string, ReturnType<typeof vi.fn>>;
    registration: {
      showNotification: ReturnType<typeof vi.fn>;
      pushManager: { subscribe: ReturnType<typeof vi.fn> };
    };
  };
  const fetch = vi.fn();
  new Function("self", "fetch", swSource)(self, fetch);
  const handler = (name: string) => self[name] as (event: unknown) => Promise<unknown>;
  return { self, fetch, listeners, handler };
}

/** An event whose `waitUntil` records the promise it was handed. */
function extendable<T extends object>(fields: T) {
  const waited: Promise<unknown>[] = [];
  return { ...fields, waited, waitUntil: (p: Promise<unknown>) => waited.push(p) };
}

function pushEvent(json: () => unknown) {
  return extendable({ data: { json } });
}

const PAYLOAD = {
  key: "airs_today:12345:2026-09-26",
  kind: "airs_today",
  title: "Severance",
  body: "S2E4 “Woe’s Hollow” airs today",
  url: "/episodes/12345",
  icon: "https://image.tmdb.org/t/p/w185/abc.jpg",
};

describe("lifecycle", () => {
  it("skips waiting on install and claims clients on activate", async () => {
    const { self, listeners } = loadWorker();

    const install = extendable({});
    listeners.install(install);
    await Promise.all(install.waited);
    expect(self.skipWaiting).toHaveBeenCalledOnce();

    const activate = extendable({});
    listeners.activate(activate);
    await Promise.all(activate.waited);
    expect(self.clients.claim).toHaveBeenCalledOnce();
  });

  it("registers no fetch handler, since nothing is cached", () => {
    const { listeners } = loadWorker();
    expect(Object.keys(listeners).sort()).toEqual([
      "activate",
      "install",
      "notificationclick",
      "push",
      "pushsubscriptionchange",
    ]);
  });
});

describe("push", () => {
  it("shows the payload's notification, tagged with its key", async () => {
    const { self, handler } = loadWorker();
    await handler("handlePush")(pushEvent(() => PAYLOAD));
    expect(self.registration.showNotification).toHaveBeenCalledWith("Severance", {
      body: PAYLOAD.body,
      icon: PAYLOAD.icon,
      tag: PAYLOAD.key,
      data: { url: "/episodes/12345" },
    });
  });

  it("omits the icon when the payload has none", async () => {
    const { self, handler } = loadWorker();
    await handler("handlePush")(pushEvent(() => ({ ...PAYLOAD, icon: undefined })));
    const [, options] = self.registration.showNotification.mock.calls[0];
    expect(options).not.toHaveProperty("icon");
  });

  it("is what the push listener waits on", async () => {
    const { self, listeners } = loadWorker();
    const event = pushEvent(() => PAYLOAD);
    listeners.push(event);
    expect(event.waited).toHaveLength(1);
    await event.waited[0];
    expect(self.registration.showNotification).toHaveBeenCalledOnce();
  });

  it.each([
    ["a non-JSON body", pushEvent(() => JSON.parse("not json"))],
    ["no data at all", extendable({ data: null })],
    ["a JSON null", pushEvent(() => null)],
    ["a missing key", pushEvent(() => ({ ...PAYLOAD, key: undefined }))],
    ["a missing title", pushEvent(() => ({ ...PAYLOAD, title: undefined }))],
    ["a missing url", pushEvent(() => ({ ...PAYLOAD, url: 42 }))],
  ])("ignores %s without throwing", async (_, event) => {
    const { self, handler } = loadWorker();
    await expect(handler("handlePush")(event)).resolves.toBeUndefined();
    expect(self.registration.showNotification).not.toHaveBeenCalled();
  });
});

describe("notificationclick", () => {
  function clickEvent(url: unknown) {
    return extendable({ notification: { close: vi.fn(), data: { url } } });
  }

  function windowClient(url: string) {
    return { url, focus: vi.fn(async () => undefined), navigate: vi.fn(async () => null) };
  }

  it("closes the notification and opens a window when none is open", async () => {
    const { self, handler } = loadWorker();
    const event = clickEvent("/episodes/12345");
    await handler("handleNotificationClick")(event);
    expect(event.notification.close).toHaveBeenCalledOnce();
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/episodes/12345`);
  });

  it("focuses and navigates an open window of this origin instead", async () => {
    const { self, handler } = loadWorker();
    const other = windowClient("https://elsewhere.example/");
    const ours = windowClient(`${ORIGIN}/my-shows`);
    self.clients.matchAll.mockResolvedValue([other, ours]);

    await handler("handleNotificationClick")(clickEvent("/shows/7"));

    expect(self.clients.matchAll).toHaveBeenCalledWith({ type: "window" });
    expect(ours.focus).toHaveBeenCalledOnce();
    expect(ours.navigate).toHaveBeenCalledWith(`${ORIGIN}/shows/7`);
    expect(other.focus).not.toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window when the open one cannot be navigated", async () => {
    const { self, handler } = loadWorker();
    const ours = windowClient(`${ORIGIN}/`);
    ours.navigate.mockRejectedValue(new TypeError("not controlled"));
    self.clients.matchAll.mockResolvedValue([ours]);

    await handler("handleNotificationClick")(clickEvent("/shows/7"));

    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/shows/7`);
  });

  it.each([
    ["a protocol-relative url", "//evil.example/phish"],
    ["an absolute foreign url", "https://evil.example/"],
    ["no url", undefined],
  ])("opens the app root for %s", async (_, url) => {
    const { self, handler } = loadWorker();
    await handler("handleNotificationClick")(clickEvent(url));
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("is what the notificationclick listener waits on", () => {
    const { listeners } = loadWorker();
    const event = clickEvent("/");
    listeners.notificationclick(event);
    expect(event.waited).toHaveLength(1);
  });
});

describe("pushsubscriptionchange", () => {
  const KEY = new Uint8Array([4, 1, 2, 3]).buffer;
  const NEW_SUB = {
    toJSON: () => ({
      endpoint: "https://push.example/new",
      expirationTime: null,
      keys: { p256dh: "p", auth: "a" },
    }),
  };

  function changeEvent(oldSubscription: unknown = { options: { applicationServerKey: KEY } }) {
    return extendable({ oldSubscription });
  }

  function ok(body: unknown) {
    return { ok: true, status: 200, json: async () => body };
  }

  it("re-subscribes with the old key and posts the new subscription with the CSRF token", async () => {
    const { self, fetch, handler } = loadWorker();
    self.registration.pushManager.subscribe.mockResolvedValue(NEW_SUB);
    fetch
      .mockResolvedValueOnce(ok({ csrf_token: "tok" }))
      .mockResolvedValueOnce({ ok: true, status: 201 });

    await handler("handlePushSubscriptionChange")(changeEvent());

    expect(self.registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: KEY,
    });
    expect(fetch).toHaveBeenNthCalledWith(1, `${API}/me`, { credentials: "include" });
    expect(fetch).toHaveBeenNthCalledWith(2, `${API}/me/push/subscriptions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "tok" },
      body: JSON.stringify({
        endpoint: "https://push.example/new",
        keys: { p256dh: "p", auth: "a" },
      }),
    });
  });

  it("posts the browser's new subscription as-is when the event carries one", async () => {
    const { self, fetch, handler } = loadWorker();
    fetch
      .mockResolvedValueOnce(ok({ csrf_token: "tok" }))
      .mockResolvedValueOnce({ ok: true, status: 201 });

    await handler("handlePushSubscriptionChange")(
      extendable({ oldSubscription: null, newSubscription: NEW_SUB }),
    );

    expect(self.registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenLastCalledWith(
      `${API}/me/push/subscriptions`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fetches the published key when there is no old subscription to take it from", async () => {
    const { self, fetch, handler } = loadWorker();
    self.registration.pushManager.subscribe.mockResolvedValue(NEW_SUB);
    fetch
      .mockResolvedValueOnce(ok({ public_key: "BPubKey" }))
      .mockResolvedValueOnce(ok({ csrf_token: "tok" }))
      .mockResolvedValueOnce({ ok: true, status: 201 });

    await handler("handlePushSubscriptionChange")(changeEvent(null));

    expect(fetch).toHaveBeenNthCalledWith(1, `${API}/push/vapid-public-key`);
    expect(self.registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: "BPubKey",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does nothing when registered without an API base", async () => {
    const { self, fetch, handler } = loadWorker({ api: null });
    await handler("handlePushSubscriptionChange")(changeEvent());
    expect(self.registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops before posting when the session is gone", async () => {
    const { self, fetch, handler } = loadWorker();
    self.registration.pushManager.subscribe.mockResolvedValue(NEW_SUB);
    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    await handler("handlePushSubscriptionChange")(changeEvent());

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("swallows a failure rather than rejecting", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { self, handler } = loadWorker();
    self.registration.pushManager.subscribe.mockRejectedValue(new Error("denied"));

    await expect(handler("handlePushSubscriptionChange")(changeEvent())).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("is what the pushsubscriptionchange listener waits on", () => {
    const { listeners } = loadWorker({ api: null });
    const event = changeEvent();
    listeners.pushsubscriptionchange(event);
    expect(event.waited).toHaveLength(1);
  });
});
