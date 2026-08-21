import { describe, expect, it, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { meHandler } from "@/test/msw/me";
import { renderWithProviders } from "@/test/renderWithProviders";
import * as connectionsApi from "@/api/connections";
import { ReportUserButton } from "./ReportUserButton";

const USER_ID = "00000000-0000-0000-0000-0000000000bb";

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

/** The four call sites deliberately do **not** re-test this flow — each asserts
 * only that it renders the control with the right props, which is the
 * discipline `ShowPoster.test.tsx` established (NEU-1168 §6). This file is
 * where the dialog, the copy, the variants and every failure branch live. */
describe("ReportUserButton", () => {
  it("names the reported user in both variants' accessible names", async () => {
    const { unmount } = renderWithProviders(
      <ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} />,
    );
    expect(screen.getByRole("button", { name: "Report Mallory (@mallory)" })).toBeInTheDocument();
    // The compact chip carries no visible text at all — the name is the whole
    // of what a screen reader gets.
    expect(screen.queryByText("Report")).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} variant="labelled" />,
    );
    const labelled = screen.getByRole("button", { name: "Report Mallory (@mallory)" });
    expect(labelled).toHaveTextContent("Report");
  });

  it("posts the typed reason and swaps to a confirmation that rules out automatic action", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${env.apiBaseUrl}/reports`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    const send = screen.getByRole("button", { name: /send report/i });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(/what happened/i), "They sent me abusive messages.");
    expect(send).toBeEnabled();
    await user.click(send);

    await waitFor(() =>
      expect(bodies).toEqual([
        { reported_user_id: USER_ID, reason: "They sent me abusive messages." },
      ]),
    );
    expect(await screen.findByText(/report received/i)).toBeInTheDocument();
    expect(screen.getByText(/a person will read this/i)).toBeInTheDocument();
    expect(
      screen.getByText(/nothing happens to Mallory's account automatically/i),
    ).toBeInTheDocument();
  });

  it("offers blocking as a separate act, and calls the block mutation", async () => {
    const block = vi.spyOn(connectionsApi, "blockUser").mockResolvedValue({
      user: { id: USER_ID, display_name: "Mallory", handle: "mallory" },
      blocked_at: "2026-08-20T00:00:00Z",
    });
    const onBlocked = vi.fn();
    renderWithProviders(
      <ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} onBlocked={onBlocked} />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    await user.type(screen.getByLabelText(/what happened/i), "Harassment.");
    await user.click(screen.getByRole("button", { name: /send report/i }));
    await screen.findByText(/report received/i);

    // The report did not block them, and the copy says so.
    expect(screen.getByText(/does not block them/i)).toBeInTheDocument();
    expect(block).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /block Mallory/i }));
    await waitFor(() => expect(block).toHaveBeenCalledWith(USER_ID));
    expect(onBlocked).toHaveBeenCalledWith(USER_ID);
    // Pressing Block closes the dialog; the block confirms itself by the row
    // disappearing, exactly as the row-level Block button already does.
    await waitFor(() => expect(screen.queryByText(/report received/i)).not.toBeInTheDocument());
  });

  it("does not offer blocking when the caller says the person is already blocked", async () => {
    renderWithProviders(<ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} canBlock={false} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    await user.type(screen.getByLabelText(/what happened/i), "Still at it.");
    await user.click(screen.getByRole("button", { name: /send report/i }));
    await screen.findByText(/report received/i);

    expect(screen.queryByRole("button", { name: /block Mallory/i })).not.toBeInTheDocument();
    expect(screen.getByText(/already blocked Mallory/i)).toBeInTheDocument();
  });

  it("keeps the typed reason on a 429 and says something distinct from a generic failure", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reports`, () =>
        HttpResponse.json({ detail: "rate_limited" }, { status: 429 }),
      ),
    );
    renderWithProviders(<ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    await user.type(screen.getByLabelText(/what happened/i), "A long account of what happened.");
    await user.click(screen.getByRole("button", { name: /send report/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/filed several reports recently/i);
    expect(alert).toHaveTextContent(/tomorrow/i);
    // Destroying a written account of harassment over an explicitly temporary
    // refusal is the worst outcome available here (§3.5).
    expect(screen.getByLabelText(/what happened/i)).toHaveValue("A long account of what happened.");
    expect(screen.queryByText(/report received/i)).not.toBeInTheDocument();
  });

  it("renders the generic failure line for a 404", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reports`, () =>
        HttpResponse.json({ detail: "reported_user_not_found" }, { status: 404 }),
      ),
    );
    renderWithProviders(<ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    await user.type(screen.getByLabelText(/what happened/i), "Something.");
    await user.click(screen.getByRole("button", { name: /send report/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not send that report/i);
    expect(alert).not.toHaveTextContent(/tomorrow/i);
  });

  it("clears the form when the dialog is dismissed and reopened", async () => {
    renderWithProviders(<ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    await user.type(screen.getByLabelText(/what happened/i), "Half a thought");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    expect(screen.getByLabelText(/what happened/i)).toHaveValue("");
  });

  it("issues no request until the reason is sent", async () => {
    let calls = 0;
    server.use(
      http.post(`${env.apiBaseUrl}/reports`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    await user.type(screen.getByLabelText(/what happened/i), "Typed but not sent.");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(calls).toBe(0);
  });

  it("is not gated on a verified email", async () => {
    // The single easiest mistake to make in this ticket (NEU-1168 §1): the
    // report button sits two lines from a Connect button that *is* gated. A
    // verified mailbox is the price of outreach, and a report touches the
    // maintainer rather than the reported user — gating it would silence the
    // newest accounts, which is exactly who a griefer targets.
    server.use(meHandler(null));
    renderWithProviders(<ReportUserButton userId={USER_ID} user={{ display_name: "Mallory", handle: "mallory" }} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Mallory (@mallory)" }));
    await user.type(screen.getByLabelText(/what happened/i), "Abusive messages.");
    await user.click(screen.getByRole("button", { name: /send report/i }));

    expect(await screen.findByText(/report received/i)).toBeInTheDocument();
  });
});
