import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { installFakePush, pretendIos, uninstallFakePush } from "@/test/push";
import {
  PushPermissionError,
  currentSubscription,
  subscribe,
  supportState,
  unsubscribe,
  urlBase64ToUint8Array,
} from "./push";

const base = env.apiBaseUrl;

afterEach(() => uninstallFakePush());

describe("supportState", () => {
  it("is unsupported without the Push APIs", () => {
    expect(supportState()).toBe("unsupported");
  });

  it.each([
    ["default", "prompt"],
    ["denied", "denied"],
    ["granted", "granted"],
  ] as const)("maps permission %s to %s", (permission, expected) => {
    installFakePush({ permission });
    expect(supportState()).toBe(expected);
  });

  it("asks an iOS tab to install first, even where the APIs are missing", () => {
    const restore = pretendIos(false);
    try {
      expect(supportState()).toBe("ios_needs_install");
    } finally {
      restore();
    }
  });

  it("treats iOS opened from the Home Screen like any other browser", () => {
    const restore = pretendIos(true);
    try {
      installFakePush({ permission: "default" });
      expect(supportState()).toBe("prompt");
    } finally {
      restore();
    }
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes unpadded base64url", () => {
    // 0xfb 0xff 0xfe is "+//+" in base64 and "-__-" in base64url.
    expect(Array.from(urlBase64ToUint8Array("-__-"))).toEqual([0xfb, 0xff, 0xfe]);
    expect(Array.from(urlBase64ToUint8Array("AQ"))).toEqual([1]);
  });
});

describe("subscribe", () => {
  it("asks once, subscribes with the server key and registers toJSON()", async () => {
    const fake = installFakePush();
    const posted: unknown[] = [];
    server.use(
      http.post(`${base}/me/push/subscriptions`, async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json({ id: "sub-1" }, { status: 201 });
      }),
    );

    await expect(subscribe("AQ")).resolves.toBe("sub-1");

    expect(fake.requestPermission).toHaveBeenCalledTimes(1);
    expect(fake.pushSubscribe).toHaveBeenCalledTimes(1);
    const options = fake.pushSubscribe.mock.calls[0][0] as PushSubscriptionOptionsInit;
    expect(options.userVisibleOnly).toBe(true);
    expect(Array.from(options.applicationServerKey as Uint8Array)).toEqual([1]);
    expect(posted).toEqual([
      {
        endpoint: "https://push.example.test/abc",
        expirationTime: null,
        keys: { p256dh: "p256", auth: "auth" },
      },
    ]);
  });

  it("asks for permission before anything else can spend the gesture", async () => {
    const fake = installFakePush();
    server.use(
      http.post(`${base}/me/push/subscriptions`, () =>
        HttpResponse.json({ id: "sub-1" }, { status: 201 }),
      ),
    );
    const pending = subscribe("AQ");
    // Checked before the first await: the prompt is requested synchronously.
    expect(fake.requestPermission).toHaveBeenCalledTimes(1);
    await pending;
  });

  it("stops at a refused prompt without subscribing", async () => {
    const fake = installFakePush({ answer: "denied" });
    await expect(subscribe("AQ")).rejects.toBeInstanceOf(PushPermissionError);
    expect(fake.pushSubscribe).not.toHaveBeenCalled();
  });
  it("drops the browser subscription when the server refuses it", async () => {
    const fake = installFakePush();
    server.use(
      http.post(`${base}/me/push/subscriptions`, () =>
        HttpResponse.json({ detail: "vapid_not_configured" }, { status: 503 }),
      ),
    );
    await expect(subscribe("AQ")).rejects.toThrow();
    expect(fake.localUnsubscribe).toHaveBeenCalledTimes(1);
    expect(fake.current()).toBeNull();
  });

  it("fails rather than hangs when no worker is registered", async () => {
    installFakePush();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: async () => undefined },
    });
    await expect(subscribe("AQ")).rejects.toThrow(/no service worker/i);
  });
});

describe("currentSubscription", () => {
  it("is null where push is unsupported", async () => {
    await expect(currentSubscription()).resolves.toBeNull();
  });

  it("returns the browser's live subscription", async () => {
    installFakePush({ permission: "granted", subscribed: true });
    expect((await currentSubscription())?.endpoint).toBe("https://push.example.test/abc");
  });
});

describe("unsubscribe", () => {
  it("drops the local subscription, then deletes its row by id", async () => {
    const fake = installFakePush({ permission: "granted", subscribed: true });
    const order: string[] = [];
    fake.localUnsubscribe.mockImplementation(async () => {
      order.push("local");
      return true;
    });
    server.use(
      http.post(`${base}/me/push/subscriptions`, () =>
        HttpResponse.json({ id: "sub-9" }, { status: 201 }),
      ),
      http.delete(`${base}/me/push/subscriptions/:id`, ({ params }) => {
        order.push(`delete ${String(params.id)}`);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await unsubscribe();
    expect(order).toEqual(["local", "delete sub-9"]);
  });

  it("does nothing when this device has no subscription", async () => {
    installFakePush({ permission: "granted" });
    await expect(unsubscribe()).resolves.toBeUndefined();
  });
});
