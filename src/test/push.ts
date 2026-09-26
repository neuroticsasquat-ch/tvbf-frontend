import { vi } from "vitest";

/**
 * A fake of the three browser APIs Web Push needs — `Notification`,
 * `PushManager` and `navigator.serviceWorker` — none of which jsdom has.
 *
 * Without it a test sees `supportState() === "unsupported"`, which is what
 * every Settings test that does not install it relies on.
 */
export interface FakePushOptions {
  permission?: NotificationPermission;
  /** What the prompt answers when `requestPermission()` is called. */
  answer?: NotificationPermission;
  subscribed?: boolean;
  endpoint?: string;
}

export interface FakePush {
  requestPermission: ReturnType<typeof vi.fn>;
  pushSubscribe: ReturnType<typeof vi.fn>;
  localUnsubscribe: ReturnType<typeof vi.fn>;
  /** The subscription the fake currently holds, as the browser would. */
  current: () => PushSubscription | null;
}

export function installFakePush({
  permission = "default",
  answer = "granted",
  subscribed = false,
  endpoint = "https://push.example.test/abc",
}: FakePushOptions = {}): FakePush {
  const state = { permission, subscription: null as PushSubscription | null };

  const localUnsubscribe = vi.fn(async () => {
    state.subscription = null;
    return true;
  });
  const makeSubscription = () =>
    ({
      endpoint,
      toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "p256", auth: "auth" } }),
      unsubscribe: localUnsubscribe,
    }) as unknown as PushSubscription;
  if (subscribed) state.subscription = makeSubscription();

  const pushSubscribe = vi.fn(async () => {
    state.subscription = makeSubscription();
    return state.subscription;
  });
  const registration = {
    pushManager: {
      subscribe: pushSubscribe,
      getSubscription: async () => state.subscription,
    },
  };

  const requestPermission = vi.fn(async () => {
    state.permission = answer;
    return answer;
  });
  const FakeNotification = {
    get permission() {
      return state.permission;
    },
    requestPermission,
  };

  Object.defineProperty(window, "Notification", { configurable: true, value: FakeNotification });
  Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: async () => registration,
    },
  });

  return { requestPermission, pushSubscribe, localUnsubscribe, current: () => state.subscription };
}

export function uninstallFakePush(): void {
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(navigator, "serviceWorker");
}

/** Pretend to be Safari on an iPhone, in a tab or opened from the Home Screen. */
export function pretendIos(standalone: boolean): () => void {
  const ua = vi
    .spyOn(navigator, "userAgent", "get")
    .mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );
  Object.defineProperty(navigator, "standalone", { configurable: true, value: standalone });
  return () => {
    ua.mockRestore();
    Reflect.deleteProperty(navigator, "standalone");
  };
}
