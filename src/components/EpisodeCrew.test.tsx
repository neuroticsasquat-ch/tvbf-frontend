import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EpisodeCrew } from "./EpisodeCrew";

const base = env.apiBaseUrl;

function renderedRows() {
  return screen.getAllByRole("listitem").map((li) => {
    const [name, role] = [...li.querySelectorAll("p")].map((p) => p.textContent ?? "");
    return `${name} — ${role}`;
  });
}

describe("EpisodeCrew", () => {
  it("renders crew in API credit order, not sorted by name or role", async () => {
    renderWithProviders(<EpisodeCrew episodeId={5000} />);
    await screen.findByRole("heading", { name: /Crew/ });

    // Sorting by name would lead with "Cy Writer"; sorting by role would lead
    // with "Director" then "Story". The API's sequence is the episode's own
    // credit order and carries meaning (ADR-0003), so neither may happen.
    expect(renderedRows()).toEqual([
      "Di Director — Director",
      "Cy Writer — Writer",
      "Cy Writer — Story",
    ]);
  });

  it("keeps both entries when one person holds two crew roles", async () => {
    renderWithProviders(<EpisodeCrew episodeId={5000} />);
    await screen.findByRole("heading", { name: /Crew/ });

    // Person 7 is credited as Writer and again as Story. Deduping by person —
    // or keying the list on person id alone — would silently drop one.
    expect(screen.getAllByRole("link", { name: "Cy Writer" })).toHaveLength(2);
    expect(screen.getByText("Writer")).toBeInTheDocument();
    expect(screen.getByText("Story")).toBeInTheDocument();
  });

  it("counts every credit in the heading, including repeat people", async () => {
    renderWithProviders(<EpisodeCrew episodeId={5000} />);

    expect(await screen.findByRole("heading", { name: "Crew (3)" })).toBeInTheDocument();
  });

  it("links each crew member to their person page", async () => {
    renderWithProviders(<EpisodeCrew episodeId={5000} />);

    expect(await screen.findByRole("link", { name: "Di Director" })).toHaveAttribute(
      "href",
      "/people/8",
    );
  });

  it("renders no section and no header when the episode has no crew", async () => {
    const { container, queryClient } = renderWithProviders(<EpisodeCrew episodeId={5001} />);

    // Wait on the query settling, not on the DOM: an unsettled query renders
    // nothing either, so asserting emptiness straight away would pass against
    // the loading state and never see the response at all.
    await waitFor(() =>
      expect(queryClient.getQueryState(["episode-crew", 5001])?.status).toBe("success"),
    );
    expect(queryClient.getQueryData(["episode-crew", 5001])).toEqual([]);

    // 22.5% of episodes land here. Absence, not an empty container element.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: /Crew/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("surfaces a failed request instead of looking empty", async () => {
    server.use(
      http.get(`${base}/episodes/5000/crew`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<EpisodeCrew episodeId={5000} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/boom/);
  });
});
