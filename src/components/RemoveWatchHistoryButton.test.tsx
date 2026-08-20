import { describe, expect, it, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RemoveWatchHistoryButton } from "./RemoveWatchHistoryButton";

/** The control's own tests, on `DismissRecommendationButton.test.tsx`'s
 * precedent (NEU-1179 §5): a control that owns its mutation is asserted once,
 * here, rather than through whichever surface happens to render it. */
describe("RemoveWatchHistoryButton (NEU-1193)", () => {
  let deleted: number[];

  beforeEach(() => {
    deleted = [];
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/:id/watched`, ({ params }) => {
        deleted.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  for (const variant of ["labelled", "compact"] as const) {
    describe(`${variant} variant`, () => {
      it("names the show in its accessible name", () => {
        renderWithProviders(
          <RemoveWatchHistoryButton showId={7} showName="Rectify" variant={variant} />,
        );
        expect(
          screen.getByRole("button", { name: "Remove Rectify watch history" }),
        ).toBeInTheDocument();
      });

      it("carries the handle the focus move queries for", () => {
        const { container } = renderWithProviders(
          <RemoveWatchHistoryButton showId={7} showName="Rectify" variant={variant} />,
        );
        expect(container.querySelector("[data-remove-watch-history]")).not.toBeNull();
      });

      it("confirms before deleting, and reports the landed removal", async () => {
        const onRemoved = vi.fn();
        renderWithProviders(
          <RemoveWatchHistoryButton
            showId={7}
            showName="Rectify"
            variant={variant}
            onRemoved={onRemoved}
          />,
        );

        await userEvent.click(screen.getByRole("button", { name: /watch history$/ }));
        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        // Nothing has been deleted yet — the dialog is the guard, and it is
        // what this control keeps where the recommendations chip has none.
        expect(deleted).toEqual([]);

        await userEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
        await waitFor(() => expect(deleted).toEqual([7]));
        await waitFor(() => expect(onRemoved).toHaveBeenCalledWith(7));
      });

      it("cancelling deletes nothing and reports nothing", async () => {
        const onRemoved = vi.fn();
        renderWithProviders(
          <RemoveWatchHistoryButton
            showId={7}
            showName="Rectify"
            variant={variant}
            onRemoved={onRemoved}
          />,
        );

        await userEvent.click(screen.getByRole("button", { name: /watch history$/ }));
        await userEvent.click(await screen.findByRole("button", { name: /cancel/i }));

        expect(deleted).toEqual([]);
        expect(onRemoved).not.toHaveBeenCalled();
      });

      it("reports nothing when the request fails", async () => {
        // The property the focus move rests on: `onRemoved` hangs off
        // `onSuccess`, so a failed removal moves nobody's focus.
        server.use(
          http.delete(
            `${env.apiBaseUrl}/me/shows/7/watched`,
            () => new HttpResponse(null, { status: 500 }),
          ),
        );
        const onRemoved = vi.fn();
        renderWithProviders(
          <RemoveWatchHistoryButton
            showId={7}
            showName="Rectify"
            variant={variant}
            onRemoved={onRemoved}
          />,
        );

        await userEvent.click(screen.getByRole("button", { name: /watch history$/ }));
        await userEvent.click(await screen.findByRole("button", { name: /^confirm$/i }));

        await waitFor(() =>
          expect(screen.getByRole("button", { name: /watch history$/ })).toBeEnabled(),
        );
        expect(onRemoved).not.toHaveBeenCalled();
      });
    });
  }

  it("defaults to the labelled variant, which carries visible text", () => {
    renderWithProviders(<RemoveWatchHistoryButton showId={7} showName="Rectify" />);
    expect(screen.getByRole("button", { name: /watch history$/ })).toHaveTextContent(
      "Watch History",
    );
  });

  it("the compact variant carries no visible text, which is why the name matters", () => {
    renderWithProviders(
      <RemoveWatchHistoryButton showId={7} showName="Rectify" variant="compact" />,
    );
    expect(screen.getByRole("button", { name: /watch history$/ })).toHaveTextContent("");
  });
});
