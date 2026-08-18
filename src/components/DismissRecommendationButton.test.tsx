import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DismissRecommendationButton } from "./DismissRecommendationButton";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(() => undefined, {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: () => undefined,
  }),
}));

describe("DismissRecommendationButton", () => {
  it("names the show in its accessible name, without calling it a preference", async () => {
    // AC 7. "Not interested" is the one phrase this feature must not use: a
    // dismissal is deliberately not a taste signal.
    renderWithProviders(<DismissRecommendationButton showId={1} showName="Severance" />);

    const chip = screen.getByRole("button", { name: /Don't recommend Severance again/i });
    expect(chip).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /not interested/i })).not.toBeInTheDocument();
  });

  it("posts the dismissal and reports it back", async () => {
    const calls: string[] = [];
    server.use(
      http.post(`${env.apiBaseUrl}/me/recommendations/:id/dismiss`, ({ params }) => {
        calls.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDismissed = vi.fn();
    renderWithProviders(
      <DismissRecommendationButton showId={7} showName="Andor" onDismissed={onDismissed} />,
    );

    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(calls).toEqual(["7"]));
    await waitFor(() => expect(onDismissed).toHaveBeenCalledWith(7));
  });

  it("disables itself while the request is in flight", async () => {
    const gate: { release: () => void } = { release: () => undefined };
    server.use(
      http.post(`${env.apiBaseUrl}/me/recommendations/:id/dismiss`, async () => {
        await new Promise<void>((resolve) => {
          gate.release = resolve;
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<DismissRecommendationButton showId={1} showName="Severance" />);

    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    gate.release();
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });

  it("toasts on failure and does not report a dismissal that never landed", async () => {
    // AC 4's other half: the toast is the whole of the feedback, because there
    // is no optimistic override to visibly revert.
    toastErrorMock.mockClear();
    server.use(
      http.post(`${env.apiBaseUrl}/me/recommendations/:id/dismiss`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const onDismissed = vi.fn();
    renderWithProviders(
      <DismissRecommendationButton showId={1} showName="Severance" onDismissed={onDismissed} />,
    );

    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(onDismissed).not.toHaveBeenCalled();
  });
  it("fires a second dismissal of the same show without checking first", async () => {
    // AC 8. The endpoint is `ON CONFLICT DO NOTHING` and answers 204 on every
    // repeat, so the client carries no guard of its own — the show can be
    // dismissed again after a refetch races, or from another surface.
    const calls: string[] = [];
    server.use(
      http.post(`${env.apiBaseUrl}/me/recommendations/:id/dismiss`, ({ params }) => {
        calls.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<DismissRecommendationButton showId={3} showName="Andor" />);

    const chip = screen.getByRole("button");
    await userEvent.click(chip);
    await waitFor(() => expect(calls).toEqual(["3"]));
    await waitFor(() => expect(chip).not.toBeDisabled());
    await userEvent.click(chip);

    await waitFor(() => expect(calls).toEqual(["3", "3"]));
  });
});
