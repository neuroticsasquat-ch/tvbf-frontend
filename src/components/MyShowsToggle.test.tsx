import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { VERIFIED_AT, meHandler } from "@/test/msw/me";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MyShowsToggle } from "./MyShowsToggle";

const base = env.apiBaseUrl;

describe("MyShowsToggle", () => {
  let deleted = 0;
  let put = 0;
  // The viewer's library as `GET /me/shows` serves it — the toggle reads only
  // whether the show is in it. A landed `DELETE` changes it, so the refetch
  // after the mutation settles agrees with the optimistic flip.
  let library: number[] = [];
  const serveLibrary = (showIds: number[]) => {
    library = showIds;
  };
  beforeEach(() => {
    deleted = 0;
    put = 0;
    library = [];
    server.use(
      meHandler(VERIFIED_AT),
      http.get(`${base}/me/shows`, () =>
        HttpResponse.json(library.map((id) => ({ show: { id, name: "The Bear" } }))),
      ),
      http.delete(`${base}/me/shows/7`, () => {
        deleted += 1;
        library = [];
        return new HttpResponse(null, { status: 204 });
      }),
      http.put(`${base}/me/shows/7`, () => {
        put += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  it("asks before removing, and Cancel sends nothing", async () => {
    // NEU-1511: this is the only removal path from the viewer's own Active
    // tab, and every removal from My Shows asks first.
    serveLibrary([7]);
    renderWithProviders(<MyShowsToggle showId={7} showName="The Bear" />);

    await userEvent.click(await screen.findByRole("button", { name: "Remove from My Shows" }));
    const dialog = screen.getByRole("dialog", { name: "Remove from My Shows" });
    expect(dialog).toHaveTextContent("The Bear");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from My Shows" })).toBeInTheDocument();
    expect(deleted).toBe(0);
  });

  it("removes the show once confirmed", async () => {
    serveLibrary([7]);
    renderWithProviders(<MyShowsToggle showId={7} showName="The Bear" />);

    await userEvent.click(await screen.findByRole("button", { name: "Remove from My Shows" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(deleted).toBe(1));
    expect(await screen.findByRole("button", { name: "Add to My Shows" })).toBeInTheDocument();
  });

  it("adds an untracked show in one activation, with no dialog", async () => {
    serveLibrary([]);
    renderWithProviders(<MyShowsToggle showId={7} showName="The Bear" />);

    await userEvent.click(await screen.findByRole("button", { name: "Add to My Shows" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(put).toBe(1));
  });

  it("keeps its loading state while the library is still arriving", async () => {
    server.use(http.get(`${base}/me/shows`, () => new Promise<never>(() => {})));
    renderWithProviders(<MyShowsToggle showId={7} showName="The Bear" />);

    const loading = await screen.findByRole("button", { name: "Loading…" });
    expect(loading).toBeDisabled();
  });
});
