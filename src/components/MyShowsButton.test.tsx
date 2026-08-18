import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MyShowsButton } from "./MyShowsButton";

describe("MyShowsButton", () => {
  it("offers to add a show the viewer does not track", () => {
    renderWithProviders(<MyShowsButton showId={1} inMyShows={false} />);
    expect(screen.getByRole("button", { name: "Add to My Shows" })).toBeInTheDocument();
  });

  it("offers to remove a show the viewer tracks", () => {
    renderWithProviders(<MyShowsButton showId={1} inMyShows />);
    expect(screen.getByRole("button", { name: "Remove from My Shows" })).toBeInTheDocument();
  });

  it("adds the show and flips optimistically, before the request settles", async () => {
    let put = 0;
    server.use(
      http.put(`${env.apiBaseUrl}/me/shows/7`, () => {
        put += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MyShowsButton showId={7} inMyShows={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Add to My Shows" }));

    expect(screen.getByRole("button", { name: "Remove from My Shows" })).toBeInTheDocument();
    await waitFor(() => expect(put).toBe(1));
  });

  it("removes the show and flips optimistically", async () => {
    let deleted = 0;
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MyShowsButton showId={7} inMyShows />);

    await userEvent.click(screen.getByRole("button", { name: "Remove from My Shows" }));

    expect(screen.getByRole("button", { name: "Add to My Shows" })).toBeInTheDocument();
    await waitFor(() => expect(deleted).toBe(1));
  });

  it("reverts the optimistic flip when the add fails", async () => {
    // The behavioural half of the extraction: this is the path that can
    // actually be wrong, and the one nobody exercises by hand.
    server.use(
      http.put(`${env.apiBaseUrl}/me/shows/7`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<MyShowsButton showId={7} inMyShows={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Add to My Shows" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add to My Shows" })).toBeInTheDocument(),
    );
  });

  it("reverts the optimistic flip when the remove fails", async () => {
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<MyShowsButton showId={7} inMyShows />);

    await userEvent.click(screen.getByRole("button", { name: "Remove from My Shows" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove from My Shows" })).toBeInTheDocument(),
    );
  });

  it("clears a stale override when upstream truth moves", async () => {
    // Without this the local guess outlives the refetch that contradicted it,
    // and the button reads the opposite of the row it sits in.
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => new HttpResponse(null, { status: 204 })),
    );

    function Harness() {
      const [tracked, setTracked] = useState(true);
      return (
        <>
          <MyShowsButton showId={7} inMyShows={tracked} />
          <button onClick={() => setTracked(false)}>upstream says no</button>
          <button onClick={() => setTracked(true)}>upstream says yes</button>
        </>
      );
    }
    renderWithProviders(<Harness />);

    // Override to "not tracked" while upstream still says tracked.
    await userEvent.click(screen.getByRole("button", { name: "Remove from My Shows" }));
    expect(screen.getByRole("button", { name: "Add to My Shows" })).toBeInTheDocument();

    // Upstream catches up, then moves back on its own. The override must not
    // survive that second move.
    await userEvent.click(screen.getByRole("button", { name: "upstream says no" }));
    await userEvent.click(screen.getByRole("button", { name: "upstream says yes" }));

    expect(screen.getByRole("button", { name: "Remove from My Shows" })).toBeInTheDocument();
  });
});
