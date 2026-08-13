import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { fixtureCast } from "@/test/msw/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowCastList } from "./CastList";

const base = env.apiBaseUrl;

function renderedNames() {
  return screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent ?? "");
}

describe("ShowCastList", () => {
  it("renders cast in API order, not alphabetical", async () => {
    renderWithProviders(<ShowCastList showId={100} />);
    await screen.findByRole("heading", { name: /Cast/ });

    // Alphabetical would be Adam, Mia, Zoe — the API's descending
    // `episode_count` order (42, 12, 1) is not.
    expect(renderedNames()).toEqual(["Zoe Lead", "Adam Second", "Mia Third"]);
  });

  it("surfaces the episode count, singular on one", async () => {
    renderWithProviders(<ShowCastList showId={100} />);

    expect(await screen.findByText("42 episodes")).toBeInTheDocument();
    expect(screen.getByText("12 episodes")).toBeInTheDocument();
    expect(screen.getByText("1 episode")).toBeInTheDocument();
  });

  it("renders the character alone when the credit carries no count", async () => {
    // The state of every credit until the API's credits routes read `catalog`
    // (NEU-1047), and permanently the state of episode guest cast.
    const uncounted = fixtureCast.map((entry) => ({
      person: entry.person,
      character: entry.character,
      self: entry.self,
      voice: entry.voice,
    }));
    server.use(http.get(`${base}/shows/100/cast`, () => HttpResponse.json(uncounted)));
    renderWithProviders(<ShowCastList showId={100} />);

    expect(await screen.findByText("Captain Alpha")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ episodes?$/)).not.toBeInTheDocument();
  });

  it("prints no count for a zero, which means missing rather than none", async () => {
    const zeroed = fixtureCast.map((entry) => ({ ...entry, episode_count: 0 }));
    server.use(http.get(`${base}/shows/100/cast`, () => HttpResponse.json(zeroed)));
    renderWithProviders(<ShowCastList showId={100} />);

    expect(await screen.findByText("Captain Alpha")).toBeInTheDocument();
    expect(screen.queryByText("0 episodes")).not.toBeInTheDocument();
  });

  it("shows the character name and marks voice roles", async () => {
    renderWithProviders(<ShowCastList showId={100} />);

    expect(await screen.findByText("Captain Alpha")).toBeInTheDocument();
    expect(screen.getByText("Doctor Beta (voice)")).toBeInTheDocument();
  });

  it("links each person to their person page", async () => {
    renderWithProviders(<ShowCastList showId={100} />);

    expect(await screen.findByRole("link", { name: "Zoe Lead" })).toHaveAttribute(
      "href",
      "/people/1",
    );
  });

  it("renders nothing when the show has no cast", async () => {
    server.use(http.get(`${base}/shows/100/cast`, () => HttpResponse.json([])));
    const { container, queryClient } = renderWithProviders(<ShowCastList showId={100} />);

    // Wait on the query settling, not on the DOM — an unsettled query renders
    // nothing too, so a bare `toBeEmptyDOMElement` would pass against the
    // loading state without ever seeing the response.
    await waitFor(() =>
      expect(queryClient.getQueryState(["show-cast", 100])?.status).toBe("success"),
    );

    // No header, no placeholder row — 27% of shows land here.
    expect(container).toBeEmptyDOMElement();
  });

  it("surfaces a failed request instead of looking empty", async () => {
    server.use(
      http.get(`${base}/shows/100/cast`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<ShowCastList showId={100} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/boom/);
  });

  it("collapses long casts behind a show-all toggle", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...fixtureCast[0],
      person: { id: 100 + i, name: `Person ${i}`, image_medium: null },
      character: { id: 200 + i, name: `Character ${i}`, image_medium: null },
    }));
    server.use(http.get(`${base}/shows/100/cast`, () => HttpResponse.json(many)));
    renderWithProviders(<ShowCastList showId={100} />);

    const toggle = await screen.findByRole("button", { name: "Show all 20" });
    expect(screen.getAllByRole("listitem")).toHaveLength(12);

    await userEvent.click(toggle);
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
  });
});
