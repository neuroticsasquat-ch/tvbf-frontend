import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { useMyWatched } from "@/api/me";
import { LibraryWatchedList } from "./LibraryWatchedList";
import type { WatchedEntry } from "@/api/types";

// The component is data-driven; this harness mirrors how MyShowsPage wires the
// hook so the existing MSW-based assertions still exercise the fetch path.
function Harness() {
  const { data, isLoading, isError } = useMyWatched();
  return <LibraryWatchedList data={data} isLoading={isLoading} isError={isError} />;
}

function makeWatched(
  showId: number,
  name: string,
  overrides: Partial<WatchedEntry> = {},
): WatchedEntry {
  return {
    show: {
      id: showId,
      name,
      type: null,
      status: "Ended",
      language: null,
      premiered: "2020-01-01",
      ended: null,
      image_medium: "https://example.com/poster.jpg",
      image_original: null,
      network: null,
      web_channel: null,
      genres: [],
      matched_aka: null,
      rating_average: null,
      my_rating: null,
    },
    watched_episode_count: 8,
    aired_episode_count: 10,
    total_episode_count: 12,
    last_watched_at: "2026-04-15T00:00:00Z",
    last_aired: "2026-04-10",
    first_watched_at: "2026-03-01T00:00:00Z",
    in_my_shows: false,
    status: "in_progress",
    my_rating: null,
    ...overrides,
  };
}

describe("LibraryWatchedList row UI", () => {
  let watchedResponse: WatchedEntry[];
  let addCalls: number[];
  let removeCalls: number[];

  beforeEach(() => {
    window.localStorage.clear();
    watchedResponse = [];
    addCalls = [];
    removeCalls = [];
    server.use(
      http.get(`${env.apiBaseUrl}/me/watched`, () => HttpResponse.json(watchedResponse)),
      http.put(`${env.apiBaseUrl}/me/shows/:id`, ({ params }) => {
        addCalls.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${env.apiBaseUrl}/me/shows/:id`, ({ params }) => {
        removeCalls.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  it("renders poster, name, counts, last-watched, status pill", async () => {
    watchedResponse = [makeWatched(101, "The Wire")];

    const { container } = renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("The Wire")).toBeInTheDocument());
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/poster.jpg");
    expect(screen.getByText(/^progress:\s*8\/10$/i)).toBeInTheDocument();
    expect(
      screen.queryByText(
        (_text, el) => el?.tagName === "SPAN" && el?.textContent === "In progress",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/last watched:.*apr/i)).toBeInTheDocument();
  });

  it("renders Finished pill when entry.status is finished", async () => {
    watchedResponse = [
      makeWatched(102, "Six Feet Under", {
        status: "finished",
        watched_episode_count: 12,
        aired_episode_count: 12,
      }),
    ];
    renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("Six Feet Under")).toBeInTheDocument());
    const matches = screen.getAllByText("Finished");
    expect(matches.some((el) => el.tagName === "SPAN")).toBe(true);
    expect(screen.queryByText(/^progress:/i)).not.toBeInTheDocument();
    expect(screen.queryByText("12/12")).not.toBeInTheDocument();
  });

  it("renders Add button when not in My Shows; clicking flips it to Remove", async () => {
    watchedResponse = [makeWatched(103, "Severance", { in_my_shows: false })];
    renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^add .+ to my shows$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^remove .+ from my shows$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^add .+ to my shows$/i }));

    await waitFor(() => expect(addCalls).toEqual([103]));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^remove .+ from my shows$/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /^add .+ to my shows$/i })).not.toBeInTheDocument();
  });

  it("renders Remove button when in My Shows; clicking flips it to Add", async () => {
    watchedResponse = [makeWatched(104, "The Sopranos", { in_my_shows: true })];
    renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("The Sopranos")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^remove .+ from my shows$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^remove .+ from my shows$/i }));

    await waitFor(() => expect(removeCalls).toEqual([104]));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^add .+ to my shows$/i })).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /^remove .+ from my shows$/i }),
    ).not.toBeInTheDocument();
  });

  it("Remove from history opens a confirm dialog and calls the API on confirm", async () => {
    let unmarkCalls: number[] = [];
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/:id/watched`, ({ params }) => {
        unmarkCalls.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    watchedResponse = [makeWatched(106, "Lost")];
    renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("Lost")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove .* watch history/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(unmarkCalls).toEqual([106]));
    await waitFor(() => expect(screen.queryByText("Lost")).not.toBeInTheDocument());
  });

  it("Remove from history cancel keeps the row and skips the API call", async () => {
    let unmarkCalls: number[] = [];
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/:id/watched`, ({ params }) => {
        unmarkCalls.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    watchedResponse = [makeWatched(107, "Fringe")];
    renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("Fringe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove .* watch history/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));

    expect(unmarkCalls).toEqual([]);
    expect(screen.getByText("Fringe")).toBeInTheDocument();
  });

  it("draws its row poster through ShowPoster rather than hand-rolling one", async () => {
    // NEU-1183 AC 3, and the fallback that came with it: this row rendered a
    // `bg-muted` div for a show with no image where the cards rendered a data
    // URI. Same picture, two behaviours, until the poster was one component.
    watchedResponse = [makeWatched(106, "Rectify")];
    const { container } = renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("Rectify")).toBeInTheDocument());
    expect(container.querySelector("[data-show-poster]")).not.toBeNull();
  });

  it("marks a tracked show in list view, where membership genuinely varies", async () => {
    // NEU-1188 AC 6. The row asked `callerPosterMark`, which hard-returns
    // `false` in self mode — right on Active, where every row is tracked by
    // definition, and wrong here, which is the whole reason `WatchedEntry`
    // carries `in_my_shows` and this tab offers a filter on it.
    watchedResponse = [
      makeWatched(108, "Andor", { in_my_shows: true }),
      makeWatched(109, "Carnivale", { in_my_shows: false }),
    ];
    renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("Andor")).toBeInTheDocument());
    // One marked and one unmarked in the same payload: a mark that is always
    // drawn passes any single-row assertion.
    expect(screen.getAllByRole("img", { name: "In your My Shows" })).toHaveLength(1);
  });

  it("shows the viewer's own rating, which the server did not send until NEU-1191", async () => {
    // NEU-1188 AC 4. A show you rated showed its stars on Active and nothing
    // here, in either view — dropped twice: the adapter hard-coded
    // `my_rating: null`, and the row rendered no badge at all.
    watchedResponse = [makeWatched(110, "Rectify", { my_rating: 4.5 })];
    const { container } = renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("Rectify")).toBeInTheDocument());
    const badge = screen.getByRole("img", { name: "Your rating: 4.5 out of 5" });
    // On the poster, not in the facts group — only the viewer's own rating may
    // occupy a corner (NEU-1182 §3.5).
    expect(container.querySelector("[data-show-poster]")?.contains(badge)).toBe(true);
  });

  it("row name links to the show detail page", async () => {
    watchedResponse = [makeWatched(105, "Deadwood")];
    renderWithProviders(<Harness />);

    await waitFor(() => expect(screen.getByText("Deadwood")).toBeInTheDocument());
    const link = screen.getByText("Deadwood").closest("a");
    expect(link).toHaveAttribute("href", "/shows/105");
  });
});
