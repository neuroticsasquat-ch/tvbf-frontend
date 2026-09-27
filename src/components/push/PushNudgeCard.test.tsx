import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { meHandler } from "@/test/msw/me";
import { installFakePush, pretendIos, uninstallFakePush, type FakePush } from "@/test/push";
import { offerInstall, withdrawInstall } from "@/test/installPrompt";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MyShowsButton } from "@/components/MyShowsButton";
import { clearPushNudge, NUDGE_DISMISSED_KEY } from "@/lib/pushNudge";
import { PushNudgeCard } from "./PushNudgeCard";

const base = env.apiBaseUrl;

function renderAddSurface() {
  renderWithProviders(
    <>
      <MyShowsButton showId={1} showName="Severance" inMyShows={false} />
      <PushNudgeCard />
    </>,
  );
}

async function add() {
  await userEvent.click(screen.getByRole("button", { name: "Add Severance to My Shows" }));
}

const card = () => screen.queryByRole("complementary", { name: "Get told when Severance airs" });

beforeEach(() => {
  localStorage.clear();
  server.use(
    meHandler(null),
    http.put(`${base}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
    http.delete(`${base}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${base}/push/vapid-public-key`, () => HttpResponse.json({ public_key: "AQ" })),
  );
});

afterEach(() => {
  act(() => clearPushNudge());
  withdrawInstall();
  uninstallFakePush();
});

describe("PushNudgeCard", () => {
  let push: FakePush;
  beforeEach(() => {
    push = installFakePush({ permission: "default" });
  });

  it("appears after an add, without asking for permission", async () => {
    renderAddSurface();
    expect(card()).not.toBeInTheDocument();
    await add();
    expect(
      await screen.findByRole("heading", { name: "Get told when Severance airs" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Turn on notifications" })).toBeInTheDocument();
    expect(push.requestPermission).not.toHaveBeenCalled();
  });

  it("shows once: closed without an answer, it still never comes back", async () => {
    renderAddSurface();
    await add();
    await screen.findByRole("heading", { name: "Get told when Severance airs" });
    // What leaving the page does (AppShell clears on navigation).
    act(() => clearPushNudge());
    expect(card()).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove Severance from My Shows" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add Severance to My Shows" })).toBeEnabled(),
    );
    await add();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove Severance from My Shows" })).toBeEnabled(),
    );
    expect(card()).not.toBeInTheDocument();
  });

  it("does not appear when the add fails", async () => {
    server.use(http.put(`${base}/me/shows/:id`, () => new HttpResponse(null, { status: 500 })));
    renderAddSurface();
    await add();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add Severance to My Shows" })).toBeEnabled(),
    );
    expect(card()).not.toBeInTheDocument();
  });

  it("never comes back once dismissed", async () => {
    renderAddSurface();
    await add();
    await screen.findByRole("heading", { name: "Get told when Severance airs" });
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(card()).not.toBeInTheDocument();
    expect(localStorage.getItem(NUDGE_DISMISSED_KEY)).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Remove Severance from My Shows" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add Severance to My Shows" })).toBeEnabled(),
    );
    await add();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove Severance from My Shows" })).toBeEnabled(),
    );
    expect(card()).not.toBeInTheDocument();
    expect(push.requestPermission).not.toHaveBeenCalled();
  });

  it("asks for permission only from its button, then never comes back", async () => {
    server.use(
      http.post(`${base}/me/push/subscriptions`, () =>
        HttpResponse.json({ id: "sub-1" }, { status: 201 }),
      ),
    );
    renderAddSurface();
    await add();
    const turnOn = await screen.findByRole("button", { name: "Turn on notifications" });
    await waitFor(() => expect(turnOn).toBeEnabled());
    expect(push.requestPermission).not.toHaveBeenCalled();

    await userEvent.click(turnOn);
    expect(push.requestPermission).toHaveBeenCalledTimes(1);
    expect(card()).not.toBeInTheDocument();
    expect(localStorage.getItem(NUDGE_DISMISSED_KEY)).not.toBeNull();
  });

  it("stays away when the key is already set", async () => {
    localStorage.setItem(NUDGE_DISMISSED_KEY, "1");
    renderAddSurface();
    await add();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove Severance from My Shows" })).toBeEnabled(),
    );
    expect(card()).not.toBeInTheDocument();
  });

  it("offers Install app only while the browser has offered an install", async () => {
    renderAddSurface();
    await add();
    await screen.findByRole("heading", { name: "Get told when Severance airs" });
    expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();

    const { prompt } = offerInstall();
    await userEvent.click(screen.getByRole("button", { name: "Install app" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(card()).not.toBeInTheDocument();
    expect(localStorage.getItem(NUDGE_DISMISSED_KEY)).not.toBeNull();
  });
});

describe("PushNudgeCard where there is nothing to turn on", () => {
  it.each(["granted", "denied"] as const)(
    "stays away when permission is %s",
    async (permission) => {
      installFakePush({ permission, subscribed: permission === "granted" });
      renderAddSurface();
      await add();
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Remove Severance from My Shows" }),
        ).toBeEnabled(),
      );
      expect(card()).not.toBeInTheDocument();
    },
  );

  it("stays away on an unsupported browser", async () => {
    renderAddSurface();
    await add();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove Severance from My Shows" })).toBeEnabled(),
    );
    expect(card()).not.toBeInTheDocument();
  });

  it("gives Add to Home Screen steps on an iOS tab, with no Turn on button", async () => {
    const restore = pretendIos(false);
    try {
      renderAddSurface();
      await add();
      await screen.findByRole("heading", { name: "Get told when Severance airs" });
      expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Turn on notifications" }),
      ).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
