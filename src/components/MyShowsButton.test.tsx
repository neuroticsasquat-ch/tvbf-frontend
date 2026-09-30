import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { meHandler } from "@/test/msw/me";
import { useRecommendations } from "@/api/me";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MyShowsButton } from "./MyShowsButton";

describe("MyShowsButton", () => {
  it("offers to add a show the viewer does not track", () => {
    renderWithProviders(<MyShowsButton showId={1} showName="The Bear" inMyShows={false} />);
    expect(screen.getByRole("button", { name: "Add The Bear to My Shows" })).toBeInTheDocument();
  });

  it("offers to remove a show the viewer tracks", () => {
    renderWithProviders(<MyShowsButton showId={1} showName="The Bear" inMyShows />);
    expect(
      screen.getByRole("button", { name: "Remove The Bear from My Shows" }),
    ).toBeInTheDocument();
  });

  it("adds the show and flips optimistically, before the request settles", async () => {
    let put = 0;
    server.use(
      http.put(`${env.apiBaseUrl}/me/shows/7`, () => {
        put += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Add The Bear to My Shows" }));

    expect(
      screen.getByRole("button", { name: "Remove The Bear from My Shows" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(put).toBe(1));
  });

  it("asks first, and sends nothing until the removal is confirmed", async () => {
    // NEU-1511 AC 2: every removal from My Shows asks first.
    let deleted = 0;
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows />);

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));

    const dialog = screen.getByRole("dialog", { name: "Remove from My Shows" });
    expect(dialog).toHaveTextContent("The Bear");
    // Nothing flips while the viewer is still deciding.
    expect(
      screen.getByRole("button", { name: "Remove The Bear from My Shows", hidden: true }),
    ).toBeInTheDocument();
    expect(deleted).toBe(0);
  });

  it("leaves the show tracked and sends nothing when the removal is cancelled", async () => {
    let deleted = 0;
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows />);

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove The Bear from My Shows" }),
    ).toBeInTheDocument();
    expect(deleted).toBe(0);
  });

  it("removes the show and flips optimistically once confirmed", async () => {
    let deleted = 0;
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows />);

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByRole("button", { name: "Add The Bear to My Shows" })).toBeInTheDocument();
    await waitFor(() => expect(deleted).toBe(1));
  });

  it("hands focus back to the button once a confirmed removal flips it to add", async () => {
    // The button must keep its DOM node across the flip: that is what lets
    // `ConfirmDialog` hand focus back to it as it closes, rather than to
    // `<body>`.
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => new HttpResponse(null, { status: 204 })),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows />);

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add The Bear to My Shows" })).toHaveFocus(),
    );
  });

  it("never asks before adding", async () => {
    // NEU-1511 AC 3: a stray add costs one un-toggle and loses nothing.
    server.use(
      http.put(`${env.apiBaseUrl}/me/shows/7`, () => new HttpResponse(null, { status: 204 })),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Add The Bear to My Shows" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("invalidates the recommendations grid when a confirmed removal lands", async () => {
    // NEU-1187 AC 5, re-homed from `LibraryActiveList` (which no longer
    // removes). `GET /me/recommendations` suppresses a suggestion the viewer
    // has a record for as a live join (NEU-1175), so a removal changes that
    // body — and the rule lives in `api/me.ts`, not in any component.
    let recommendationFetches = 0;
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => new HttpResponse(null, { status: 204 })),
      http.get(`${env.apiBaseUrl}/me/recommendations`, () => {
        recommendationFetches += 1;
        return HttpResponse.json({ recommendations: [] });
      }),
    );

    function Harness() {
      useRecommendations();
      return <MyShowsButton showId={7} showName="The Bear" inMyShows />;
    }
    renderWithProviders(<Harness />);
    await waitFor(() => expect(recommendationFetches).toBe(1));

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(recommendationFetches).toBe(2));
  });

  it("reverts the optimistic flip when the add fails", async () => {
    // The behavioural half of the extraction: this is the path that can
    // actually be wrong, and the one nobody exercises by hand.
    server.use(
      http.put(`${env.apiBaseUrl}/me/shows/7`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Add The Bear to My Shows" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add The Bear to My Shows" })).toBeInTheDocument(),
    );
  });

  it("reverts the optimistic flip when the remove fails", async () => {
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows />);

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove The Bear from My Shows" }),
      ).toBeInTheDocument(),
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
          <MyShowsButton showId={7} showName="The Bear" inMyShows={tracked} />
          <button onClick={() => setTracked(false)}>upstream says no</button>
          <button onClick={() => setTracked(true)}>upstream says yes</button>
        </>
      );
    }
    renderWithProviders(<Harness />);

    // Override to "not tracked" while upstream still says tracked.
    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("button", { name: "Add The Bear to My Shows" })).toBeInTheDocument();

    // Upstream catches up, then moves back on its own. The override must not
    // survive that second move.
    await userEvent.click(screen.getByRole("button", { name: "upstream says no" }));
    await userEvent.click(screen.getByRole("button", { name: "upstream says yes" }));

    expect(
      screen.getByRole("button", { name: "Remove The Bear from My Shows" }),
    ).toBeInTheDocument();
  });

  it("names the show on the labelled variant, where twelve identical labels otherwise sit on one grid", () => {
    // NEU-1187 §D3. The visible text stays "My Shows"; the accessible name is
    // what carries the show.
    renderWithProviders(<MyShowsButton showId={1} showName="Severance" inMyShows={false} />);
    const button = screen.getByRole("button", { name: "Add Severance to My Shows" });
    expect(button).toHaveTextContent("My Shows");
  });

  it("adds a show for an unverified viewer — verification gates social, not tracking", async () => {
    // NEU-1161 gates `POST /connection-requests` and search visibility, and
    // nothing else. My Shows, watch tracking and browse are untouched, which is
    // the half of the change nobody would notice breaking until a new signup
    // could not track a show.
    server.use(meHandler(null));
    let put = 0;
    server.use(
      http.put(`${env.apiBaseUrl}/me/shows/7`, () => {
        put += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Add The Bear to My Shows" }));

    await waitFor(() => expect(put).toBe(1));
  });
});
