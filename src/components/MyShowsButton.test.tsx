import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { meHandler } from "@/test/msw/me";
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

  it("removes the show and flips optimistically", async () => {
    let deleted = 0;
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MyShowsButton showId={7} showName="The Bear" inMyShows />);

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));

    expect(screen.getByRole("button", { name: "Add The Bear to My Shows" })).toBeInTheDocument();
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

  it("draws the compact variant icon-only, with the show's name as its accessible name", () => {
    renderWithProviders(
      <MyShowsButton showId={1} showName="Severance" inMyShows variant="compact" />,
    );
    const chip = screen.getByRole("button", { name: "Remove Severance from My Shows" });
    // Icon-only: no visible label to read, which is what makes the accessible
    // name load-bearing rather than nice.
    expect(chip).toHaveTextContent("");
    expect(chip).toHaveAttribute("data-remove-from-my-shows");
    // `BookMinus`, never the emerald ✓ — that means *watched* everywhere else.
    expect(chip.querySelector(".lucide-book-minus")).not.toBeNull();
  });

  it("renders the compact variant's add state too, rather than hard-coding remove", () => {
    // Its one surface can only ever reach the remove state; hard-coding it
    // would put a second decision inside a component that takes the answer.
    renderWithProviders(
      <MyShowsButton showId={1} showName="Severance" inMyShows={false} variant="compact" />,
    );
    expect(screen.getByRole("button", { name: "Add Severance to My Shows" })).toBeInTheDocument();
  });

  it("reports a landed removal to its surface, so focus can move after the card unmounts", async () => {
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () => new HttpResponse(null, { status: 204 })),
    );
    const removed: number[] = [];
    renderWithProviders(
      <MyShowsButton
        showId={7}
        showName="The Bear"
        inMyShows
        variant="compact"
        onRemoved={(id) => removed.push(id)}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));

    await waitFor(() => expect(removed).toEqual([7]));
  });

  it("does not report a removal that failed", async () => {
    // Nothing left the list, so nothing freed a slot and nobody's focus moves.
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/7`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const removed: number[] = [];
    renderWithProviders(
      <MyShowsButton
        showId={7}
        showName="The Bear"
        inMyShows
        variant="compact"
        onRemoved={(id) => removed.push(id)}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove The Bear from My Shows" }),
      ).toBeInTheDocument(),
    );
    expect(removed).toEqual([]);
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
