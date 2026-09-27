import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MuteShowButton } from "./MuteShowButton";

describe("MuteShowButton", () => {
  for (const variant of ["labelled", "compact"] as const) {
    it(`names the show and the action in the ${variant} variant`, () => {
      renderWithProviders(
        <MuteShowButton showId={1} showName="The Bear" muted={false} variant={variant} />,
      );
      expect(
        screen.getByRole("button", { name: "Mute notifications for The Bear" }),
      ).toBeInTheDocument();
    });
  }

  it("offers to unmute a muted show", () => {
    renderWithProviders(<MuteShowButton showId={1} showName="The Bear" muted />);
    const button = screen.getByRole("button", { name: "Unmute notifications for The Bear" });
    expect(button).toHaveTextContent("Unmute");
  });

  it("mutes optimistically, before the request settles, and sends the new value", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${env.apiBaseUrl}/me/shows/7/mute`, async ({ request }) => {
        bodies.push(await request.json());
        await gate;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MuteShowButton showId={7} showName="The Bear" muted={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Mute notifications for The Bear" }));

    // Flipped while the request is still held open.
    expect(
      screen.getByRole("button", { name: "Unmute notifications for The Bear" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(bodies).toEqual([{ muted: true }]));
    release();
  });

  it("rolls the optimistic flip back when the request fails", async () => {
    server.use(
      http.patch(`${env.apiBaseUrl}/me/shows/7/mute`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<MuteShowButton showId={7} showName="The Bear" muted />);

    await userEvent.click(
      screen.getByRole("button", { name: "Unmute notifications for The Bear" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Unmute notifications for The Bear" }),
      ).toBeEnabled(),
    );
  });
});
