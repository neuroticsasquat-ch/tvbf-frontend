import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CrewList } from "./CrewList";

const base = env.apiBaseUrl;

describe("CrewList", () => {
  it("groups crew by role in API order", async () => {
    renderWithProviders(<CrewList showId={100} />);
    await screen.findByRole("heading", { name: /Crew/ });

    // Roles keep first-appearance order — alphabetical would lead with Composer.
    const roles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(roles).toEqual(["Creator", "Executive Producer", "Writer", "Director", "Composer"]);
  });

  it("keeps API order for people inside a role group", async () => {
    renderWithProviders(<CrewList showId={100} />);
    const heading = await screen.findByRole("heading", { name: "Executive Producer" });
    const group = heading.parentElement as HTMLElement;

    expect(
      within(group)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Ada Producer", "Bo Producer"]);
  });

  it("caps entries — not role groups — behind a show-all toggle", async () => {
    // One 30-person role: capping groups instead of entries would still paint
    // all 30 on first render.
    const many = Array.from({ length: 30 }, (_, i) => ({
      person: { id: 100 + i, name: `Writer ${i}`, image_medium: null },
      role: "Writer",
    }));
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json(many)));
    renderWithProviders(<CrewList showId={100} />);

    const toggle = await screen.findByRole("button", { name: "Show all 30" });
    expect(screen.getAllByRole("listitem")).toHaveLength(12);

    await userEvent.click(toggle);
    expect(screen.getAllByRole("listitem")).toHaveLength(30);
  });

  it("renders nothing when the show has no crew", async () => {
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])));
    const { container } = renderWithProviders(<CrewList showId={100} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("surfaces a failed request instead of looking empty", async () => {
    server.use(
      http.get(`${base}/shows/100/crew`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<CrewList showId={100} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/boom/);
  });
});
