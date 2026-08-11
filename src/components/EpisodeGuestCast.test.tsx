import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EpisodeGuestCast } from "./EpisodeGuestCast";

const base = env.apiBaseUrl;

function renderedNames() {
  return screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent ?? "");
}

describe("EpisodeGuestCast", () => {
  it("renders guest cast in API order, not alphabetical", async () => {
    renderWithProviders(<EpisodeGuestCast episodeId={5000} />);
    await screen.findByRole("heading", { name: /Guest cast/ });

    // Alphabetical would put Ana first; the API's order is the credited order.
    expect(renderedNames()).toEqual(["Gus Guest", "Ana Cameo"]);
  });

  it("shows the character name and marks voice roles", async () => {
    renderWithProviders(<EpisodeGuestCast episodeId={5000} />);

    expect(await screen.findByText("The Stranger")).toBeInTheDocument();
    expect(screen.getByText("Radio Announcer (voice)")).toBeInTheDocument();
  });

  it("shows no episode count — a guest credit is already per-episode", async () => {
    // Permanent, not a stopgap: `catalog` records guest cast at episode grain
    // with no count to carry, so this stays true after the credits routes move
    // to it (NEU-1047). Asserted on the rendered surface rather than left to
    // the fixture, which a later edit could unpin in silence.
    renderWithProviders(<EpisodeGuestCast episodeId={5000} />);

    expect(await screen.findByText("The Stranger")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ episodes?$/)).not.toBeInTheDocument();
  });

  it("links each guest to their person page", async () => {
    renderWithProviders(<EpisodeGuestCast episodeId={5000} />);

    expect(await screen.findByRole("link", { name: "Gus Guest" })).toHaveAttribute(
      "href",
      "/people/6",
    );
  });

  it("renders no section and no header when the episode has no guest cast", async () => {
    const { container, queryClient } = renderWithProviders(<EpisodeGuestCast episodeId={5001} />);

    // Wait on the query settling, not on the DOM: an unsettled query renders
    // nothing either, so asserting emptiness straight away would pass against
    // the loading state and never see the response at all.
    await waitFor(() =>
      expect(queryClient.getQueryState(["episode-guest-cast", 5001])?.status).toBe("success"),
    );
    expect(queryClient.getQueryData(["episode-guest-cast", 5001])).toEqual([]);

    // 96% of episodes land here. Absence, not an empty container element —
    // there is no section, no header and no list.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: /Guest cast/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("surfaces a failed request instead of looking empty", async () => {
    server.use(
      http.get(`${base}/episodes/5000/guest-cast`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<EpisodeGuestCast episodeId={5000} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/boom/);
  });
});
