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
