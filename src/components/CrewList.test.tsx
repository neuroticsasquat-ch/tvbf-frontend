import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowCrewList, ShowEpisodeCrewList } from "./CrewList";

const base = env.apiBaseUrl;

describe("ShowCrewList", () => {
  it("groups crew by role in API order", async () => {
    renderWithProviders(<ShowCrewList showId={100} />);
    await screen.findByRole("heading", { name: /Crew/ });

    // Roles keep first-appearance order — alphabetical would lead with Composer.
    const roles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(roles).toEqual(["Creator", "Executive Producer", "Writer", "Director", "Composer"]);
  });

  it("keeps API order for people inside a role group", async () => {
    renderWithProviders(<ShowCrewList showId={100} />);
    const heading = await screen.findByRole("heading", { name: "Executive Producer" });
    const group = heading.parentElement as HTMLElement;

    expect(
      within(group)
        .getAllByRole("listitem")
        .map((li) => li.querySelector("p")?.textContent),
    ).toEqual(["Ada Producer", "Bo Producer"]);
  });

  it("states each credit's episode count, singular on one", async () => {
    // Series crew carries the show's aggregate since NEU-1512.
    renderWithProviders(<ShowCrewList showId={100} />);
    const heading = await screen.findByRole("heading", { name: "Executive Producer" });
    const group = within(heading.parentElement as HTMLElement);

    expect(group.getByText("40 episodes")).toBeInTheDocument();
    expect(group.getByText("30 episodes")).toBeInTheDocument();
    expect(screen.getAllByText("1 episode")).toHaveLength(2);
  });

  it("caps entries — not role groups — behind a show-all toggle", async () => {
    // One 30-person role: capping groups instead of entries would still paint
    // all 30 on first render.
    const many = Array.from({ length: 30 }, (_, i) => ({
      person: { id: 100 + i, name: `Writer ${i}`, image_medium: null },
      role: "Writer",
      episode_count: 1,
    }));
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json(many)));
    renderWithProviders(<ShowCrewList showId={100} />);

    const toggle = await screen.findByRole("button", { name: "Show all 30" });
    expect(screen.getAllByRole("listitem")).toHaveLength(12);

    await userEvent.click(toggle);
    expect(screen.getAllByRole("listitem")).toHaveLength(30);
  });

  it("renders nothing when the show has no crew", async () => {
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])));
    const { container } = renderWithProviders(<ShowCrewList showId={100} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("surfaces a failed request instead of looking empty", async () => {
    server.use(
      http.get(`${base}/shows/100/crew`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<ShowCrewList showId={100} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/boom/);
  });
});

describe("ShowEpisodeCrewList", () => {
  it("renders the show's episode crew under its own heading, with counts", async () => {
    renderWithProviders(<ShowEpisodeCrewList showId={100} />);

    expect(await screen.findByRole("heading", { name: /^Episode crew \(2\)/ })).toBeInTheDocument();
    expect(screen.getByText("5 episodes")).toBeInTheDocument();
    expect(screen.getByText("2 episodes")).toBeInTheDocument();
  });

  it("renders nothing when the show has none", async () => {
    server.use(http.get(`${base}/shows/100/episode-crew`, () => HttpResponse.json([])));
    const { container, queryClient } = renderWithProviders(<ShowEpisodeCrewList showId={100} />);

    await waitFor(() =>
      expect(queryClient.getQueryState(["show-episode-crew", 100])?.status).toBe("success"),
    );
    expect(container).toBeEmptyDOMElement();
  });
});
