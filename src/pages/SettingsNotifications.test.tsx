import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { meHandler } from "@/test/msw/me";
import { installFakePush, pretendIos, uninstallFakePush } from "@/test/push";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "./SettingsPage";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(() => undefined, {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  }),
}));

const base = env.apiBaseUrl;

function vapidKey() {
  return http.get(`${base}/push/vapid-public-key`, () => HttpResponse.json({ public_key: "AQ" }));
}

function registers(id = "sub-1") {
  return http.post(`${base}/me/push/subscriptions`, () =>
    HttpResponse.json({ id }, { status: 201 }),
  );
}

async function renderSection() {
  renderWithProviders(<SettingsPage />, { route: "/settings" });
  return within(await screen.findByRole("region", { name: "Notifications" }));
}

beforeEach(() => {
  server.use(meHandler(null));
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => uninstallFakePush());

describe("Settings → Notifications state line", () => {
  it("explains an unsupported browser", async () => {
    const section = await renderSection();
    expect(await section.findByText(/can't receive notifications/i)).toBeInTheDocument();
    expect(section.queryByRole("button")).not.toBeInTheDocument();
  });

  it("gives Add to Home Screen instructions on an iOS tab", async () => {
    const restore = pretendIos(false);
    try {
      const section = await renderSection();
      expect(await section.findByText(/add to home screen/i)).toBeInTheDocument();
      expect(section.getByText(/share button/i)).toBeInTheDocument();
      expect(section.queryByRole("button")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("says how to re-enable a denied permission", async () => {
    installFakePush({ permission: "denied" });
    const section = await renderSection();
    expect(await section.findByText(/blocked for this site/i)).toBeInTheDocument();
    expect(section.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers Turn on notifications when permission can be asked", async () => {
    installFakePush({ permission: "default" });
    server.use(vapidKey());
    const section = await renderSection();
    const button = await section.findByRole("button", { name: "Turn on notifications" });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("offers Turn on when permission is granted but this device is not subscribed", async () => {
    installFakePush({ permission: "granted" });
    server.use(vapidKey());
    const section = await renderSection();
    const button = await section.findByRole("button", { name: "Turn on notifications" });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("says the server can't do push when it has no VAPID key", async () => {
    installFakePush({ permission: "default" });
    server.use(
      http.get(`${base}/push/vapid-public-key`, () =>
        HttpResponse.json({ detail: "vapid_not_configured" }, { status: 503 }),
      ),
    );
    const section = await renderSection();
    expect(await section.findByText(/aren't available right now/i)).toBeInTheDocument();
  });

  it("shows On for this device with a Send test button when subscribed", async () => {
    installFakePush({ permission: "granted", subscribed: true });
    const section = await renderSection();
    expect(await section.findByText("On for this device")).toBeInTheDocument();
    expect(section.getByRole("button", { name: "Send test notification" })).toBeEnabled();
  });
});

describe("Turn on notifications", () => {
  it("asks for permission exactly once, and only from the click", async () => {
    const fake = installFakePush({ permission: "default" });
    server.use(vapidKey(), registers());
    const section = await renderSection();
    const button = await section.findByRole("button", { name: "Turn on notifications" });
    await waitFor(() => expect(button).toBeEnabled());
    expect(fake.requestPermission).not.toHaveBeenCalled();

    await userEvent.click(button);

    expect(await section.findByText("On for this device")).toBeInTheDocument();
    expect(fake.requestPermission).toHaveBeenCalledTimes(1);
    expect(fake.pushSubscribe).toHaveBeenCalledTimes(1);
  });

  it("shows the denied line after a refused prompt, without an error toast", async () => {
    installFakePush({ permission: "default", answer: "denied" });
    server.use(vapidKey());
    const section = await renderSection();
    const button = await section.findByRole("button", { name: "Turn on notifications" });
    await waitFor(() => expect(button).toBeEnabled());

    await userEvent.click(button);

    expect(await section.findByText(/blocked for this site/i)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts and stays off when registering with the server fails", async () => {
    const fake = installFakePush({ permission: "default" });
    server.use(
      vapidKey(),
      http.post(`${base}/me/push/subscriptions`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const section = await renderSection();
    const button = await section.findByRole("button", { name: "Turn on notifications" });
    await waitFor(() => expect(button).toBeEnabled());

    await userEvent.click(button);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Couldn't turn on notifications. Try again."),
    );
    expect(fake.current()).toBeNull();
    expect(section.queryByText("On for this device")).not.toBeInTheDocument();
  });
});

describe("Send test notification", () => {
  it("sends to this device's id and toasts success", async () => {
    installFakePush({ permission: "granted", subscribed: true });
    const bodies: unknown[] = [];
    server.use(
      registers("sub-7"),
      http.post(`${base}/me/push/test`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ status: "sent", status_code: 201 }, { status: 202 });
      }),
    );
    const section = await renderSection();
    await userEvent.click(await section.findByRole("button", { name: "Send test notification" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Test notification sent."));
    expect(bodies).toEqual([{ subscription_id: "sub-7" }]);
  });

  it("toasts a failure the server reports inside its 202", async () => {
    installFakePush({ permission: "granted", subscribed: true });
    server.use(
      registers(),
      http.post(`${base}/me/push/test`, () =>
        HttpResponse.json({ status: "failed", status_code: 500 }, { status: 202 }),
      ),
    );
    const section = await renderSection();
    await userEvent.click(await section.findByRole("button", { name: "Send test notification" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("drops the local subscription on a 410 and offers Turn on again", async () => {
    const fake = installFakePush({ permission: "granted", subscribed: true });
    server.use(
      vapidKey(),
      registers(),
      http.post(`${base}/me/push/test`, () =>
        HttpResponse.json({ status: "gone", status_code: 410 }, { status: 410 }),
      ),
    );
    const section = await renderSection();
    await userEvent.click(await section.findByRole("button", { name: "Send test notification" }));

    expect(await section.findByRole("button", { name: "Turn on notifications" })).toBeInTheDocument();
    expect(fake.localUnsubscribe).toHaveBeenCalledTimes(1);
    expect(fake.current()).toBeNull();
    expect(toastError).toHaveBeenCalled();
  });

  it("toasts the throttle", async () => {
    installFakePush({ permission: "granted", subscribed: true });
    server.use(
      registers(),
      http.post(`${base}/me/push/test`, () =>
        HttpResponse.json({ detail: "rate_limited" }, { status: 429 }),
      ),
    );
    const section = await renderSection();
    await userEvent.click(await section.findByRole("button", { name: "Send test notification" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "You've sent several test notifications recently. Try again later.",
      ),
    );
  });
});

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

/** A stateful `/me/push/subscriptions`: the list, and both DELETEs that
 * shrink it, so a refetch after a removal sees the removal. */
function devices(rows: Array<{ id: string; user_agent: string | null; last_success_at?: string }>) {
  const state = {
    rows: rows.map((r) => ({
      id: r.id,
      user_agent: r.user_agent,
      created_at: "2026-09-01T12:00:00Z",
      last_success_at: r.last_success_at ?? null,
    })),
    deleted: [] as string[],
    deletedAll: 0,
  };
  const handlers = [
    http.get(`${base}/me/push/subscriptions`, () => HttpResponse.json(state.rows)),
    http.delete(`${base}/me/push/subscriptions/:id`, ({ params }) => {
      state.deleted.push(params.id as string);
      state.rows = state.rows.filter((r) => r.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete(`${base}/me/push/subscriptions`, () => {
      state.deletedAll += 1;
      state.rows = [];
      return new HttpResponse(null, { status: 204 });
    }),
  ];
  return { state, handlers };
}

const KINDS = [
  "Episode airs today",
  "Premiere date set",
  "Premiere date moved",
  "Show ended or cancelled",
  "Show revived",
];

describe("Notification toggles", () => {
  it("are disabled with a hint when no device is subscribed", async () => {
    const section = await renderSection();
    expect(await section.findByText("Turn on notifications on a device first.")).toBeInTheDocument();
    for (const name of KINDS) {
      expect(section.getByRole("switch", { name })).toBeDisabled();
    }
  });

  it("stay disabled without the hint when the device list fails to load", async () => {
    server.use(
      http.get(`${base}/me/push/subscriptions`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const section = await renderSection();
    expect(await section.findByRole("switch", { name: "Show revived" })).toBeDisabled();
    await new Promise((r) => setTimeout(r, 50));
    expect(section.queryByText("Turn on notifications on a device first.")).not.toBeInTheDocument();
  });

  it("round-trip a flip through PATCH /me/preferences", async () => {
    const bodies: unknown[] = [];
    server.use(
      ...devices([{ id: "sub-1", user_agent: WINDOWS_CHROME }]).handlers,
      http.patch(`${base}/me/preferences`, async ({ request }) => {
        const body = (await request.json()) as Record<string, boolean>;
        bodies.push(body);
        return HttpResponse.json({
          id: "u1",
          email: "alice@example.com",
          display_name: "Alice",
          created_at: "2026-01-01T00:00:00Z",
          email_verified_at: null,
          csrf_token: "test-csrf",
          activity_feed_enabled: true,
          is_admin: false,
          notify_airs_today: true,
          notify_premiere_set: true,
          notify_premiere_moved: true,
          notify_ended: true,
          notify_revived: true,
          ...body,
        });
      }),
    );
    const section = await renderSection();
    const revived = await section.findByRole("switch", { name: "Show revived" });
    await waitFor(() => expect(revived).toBeEnabled());
    expect(revived).toBeChecked();
    expect(section.queryByText("Turn on notifications on a device first.")).not.toBeInTheDocument();

    await userEvent.click(revived);

    await waitFor(() => expect(bodies).toEqual([{ notify_revived: false }]));
    await waitFor(() => expect(revived).toBeEnabled());
    expect(revived).not.toBeChecked();
    expect(section.getByRole("switch", { name: "Episode airs today" })).toBeChecked();
  });

  it("roll back and toast when the save fails", async () => {
    server.use(
      ...devices([{ id: "sub-1", user_agent: WINDOWS_CHROME }]).handlers,
      http.patch(`${base}/me/preferences`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const section = await renderSection();
    const airs = await section.findByRole("switch", { name: "Episode airs today" });
    await waitFor(() => expect(airs).toBeEnabled());

    await userEvent.click(airs);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Could not update preferences."));
    await waitFor(() => expect(airs).toBeChecked());
  });
});

describe("Device list", () => {
  it("lists each device with its label, added date and last delivery", async () => {
    server.use(
      ...devices([
        { id: "sub-1", user_agent: IPHONE_SAFARI, last_success_at: new Date().toISOString() },
        { id: "sub-2", user_agent: WINDOWS_CHROME },
        { id: "sub-3", user_agent: null },
      ]).handlers,
    );
    const section = await renderSection();
    const list = within(await section.findByRole("list", { name: "Devices" }));
    const rows = list.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("iPhone · Safari")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/Last delivered just now/)).toBeInTheDocument();
    expect(within(rows[1]).getByText("Windows · Chrome")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Last delivered never")).toBeInTheDocument();
    expect(within(rows[1]).getByText(/^Added /)).toBeInTheDocument();
    expect(within(rows[2]).getByText("Unknown device")).toBeInTheDocument();
    expect(section.getByRole("button", { name: "Turn off everywhere" })).toBeInTheDocument();
  });

  it("is absent when no device is subscribed", async () => {
    const section = await renderSection();
    await section.findByText("Turn on notifications on a device first.");
    expect(section.queryByRole("list", { name: "Devices" })).not.toBeInTheDocument();
    expect(section.queryByRole("button", { name: "Turn off everywhere" })).not.toBeInTheDocument();
  });

  it("removes another device by id and leaves this one subscribed", async () => {
    const fake = installFakePush({ permission: "granted", subscribed: true });
    const d = devices([
      { id: "sub-1", user_agent: IPHONE_SAFARI },
      { id: "sub-2", user_agent: WINDOWS_CHROME },
    ]);
    server.use(...d.handlers, registers("sub-1"));
    const section = await renderSection();

    await userEvent.click(
      await section.findByRole("button", { name: /^Remove Windows · Chrome/ }),
    );

    await waitFor(() => expect(section.queryByText("Windows · Chrome")).not.toBeInTheDocument());
    expect(d.state.deleted).toEqual(["sub-2"]);
    expect(fake.localUnsubscribe).not.toHaveBeenCalled();
    expect(section.getByText("On for this device")).toBeInTheDocument();
  });

  it("unsubscribes locally too when removing this device", async () => {
    const fake = installFakePush({ permission: "granted", subscribed: true });
    const d = devices([
      { id: "sub-1", user_agent: IPHONE_SAFARI },
      { id: "sub-2", user_agent: WINDOWS_CHROME },
    ]);
    server.use(...d.handlers, registers("sub-1"), vapidKey());
    const section = await renderSection();

    await userEvent.click(await section.findByRole("button", { name: /^Remove iPhone · Safari/ }));

    expect(await section.findByRole("button", { name: "Turn on notifications" })).toBeInTheDocument();
    expect(d.state.deleted).toEqual(["sub-1"]);
    expect(fake.localUnsubscribe).toHaveBeenCalledTimes(1);
    expect(fake.current()).toBeNull();
    expect(section.getByText("Windows · Chrome")).toBeInTheDocument();
  });

  it("toasts when a removal fails", async () => {
    // The failing DELETE goes first: of handlers passed to one `use`, the
    // earliest match wins.
    server.use(
      http.delete(`${base}/me/push/subscriptions/:id`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
      ...devices([{ id: "sub-2", user_agent: WINDOWS_CHROME }]).handlers,
    );
    const section = await renderSection();
    await userEvent.click(
      await section.findByRole("button", { name: /^Remove Windows · Chrome/ }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Couldn't remove that device. Try again."),
    );
    expect(section.getByText("Windows · Chrome")).toBeInTheDocument();
  });

  it("turns off everywhere after confirming, locally too", async () => {
    const fake = installFakePush({ permission: "granted", subscribed: true });
    const d = devices([
      { id: "sub-1", user_agent: IPHONE_SAFARI },
      { id: "sub-2", user_agent: WINDOWS_CHROME },
    ]);
    server.use(...d.handlers, vapidKey());
    const section = await renderSection();

    await userEvent.click(await section.findByRole("button", { name: "Turn off everywhere" }));
    const dialog = await screen.findByRole("dialog", { name: "Turn off everywhere" });
    expect(d.state.deletedAll).toBe(0);
    await userEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));

    await waitFor(() => expect(section.queryByRole("list", { name: "Devices" })).not.toBeInTheDocument());
    expect(d.state.deletedAll).toBe(1);
    expect(fake.localUnsubscribe).toHaveBeenCalledTimes(1);
    expect(await section.findByRole("button", { name: "Turn on notifications" })).toBeInTheDocument();
    expect(section.getByText("Turn on notifications on a device first.")).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Notifications turned off on every device.");
  });

  it("does nothing when the confirmation is cancelled", async () => {
    const d = devices([{ id: "sub-2", user_agent: WINDOWS_CHROME }]);
    server.use(...d.handlers);
    const section = await renderSection();

    await userEvent.click(await section.findByRole("button", { name: "Turn off everywhere" }));
    const dialog = await screen.findByRole("dialog", { name: "Turn off everywhere" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(d.state.deletedAll).toBe(0);
    expect(section.getByText("Windows · Chrome")).toBeInTheDocument();
  });
});
