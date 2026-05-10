import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { UpcomingPage } from "./UpcomingPage";

describe("UpcomingPage", () => {
  let seasonsCalls: URL[];
  let showsCalls: URL[];

  beforeEach(() => {
    window.localStorage.clear();
    seasonsCalls = [];
    showsCalls = [];
    server.use(
      http.get(`${env.apiBaseUrl}/me/upcoming`, () => HttpResponse.json([])),
      http.get(`${env.apiBaseUrl}/me/upcoming/seasons`, ({ request }) => {
        seasonsCalls.push(new URL(request.url));
        return HttpResponse.json([
          {
            show: {
              id: 11,
              name: "Severance",
              type: null,
              status: null,
              language: null,
              premiered: null,
              ended: null,
              image_medium: null,
              image_original: null,
              network: null,
              web_channel: null,
              genres: [],
              matched_aka: null,
            },
            season_number: 2,
            season_name: "Block 2",
            premiere_date: "2026-06-01",
            added_at: "2026-04-01T00:00:00Z",
          },
          {
            show: {
              id: 12,
              name: "Lost",
              type: null,
              status: null,
              language: null,
              premiered: null,
              ended: null,
              image_medium: null,
              image_original: null,
              network: null,
              web_channel: null,
              genres: [],
              matched_aka: null,
            },
            season_number: 3,
            season_name: null,
            premiere_date: null,
            added_at: "2026-04-02T00:00:00Z",
          },
        ]);
      }),
      http.get(`${env.apiBaseUrl}/me/upcoming/shows`, ({ request }) => {
        showsCalls.push(new URL(request.url));
        return HttpResponse.json([
          {
            show: {
              id: 21,
              name: "Brand New",
              type: null,
              status: "In Development",
              language: null,
              premiered: null,
              ended: null,
              image_medium: null,
              image_original: null,
              network: null,
              web_channel: null,
              genres: [],
              matched_aka: null,
            },
            premiere_date: null,
            added_at: "2026-04-03T00:00:00Z",
          },
        ]);
      }),
    );
  });

  it("renders Episodes / Seasons / Shows tabs with Episodes selected by default", async () => {
    renderWithProviders(<UpcomingPage />);

    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
    expect(screen.getByRole("tab", { name: /^episodes$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /^seasons$/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: /^shows$/i })).toHaveAttribute("aria-selected", "false");
  });

  it("does not fetch seasons or shows until their tabs are clicked", async () => {
    renderWithProviders(<UpcomingPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /episodes/i })).toBeInTheDocument());
    expect(seasonsCalls).toHaveLength(0);
    expect(showsCalls).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: /seasons/i }));
    await waitFor(() => expect(seasonsCalls.length).toBeGreaterThan(0));
    expect(showsCalls).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: /shows/i }));
    await waitFor(() => expect(showsCalls.length).toBeGreaterThan(0));
  });

  it("Seasons tab renders rows with season number, name, premiere date, and TBA fallback", async () => {
    renderWithProviders(<UpcomingPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /seasons/i }));

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    expect(screen.getByText(/season 2 — block 2/i)).toBeInTheDocument();
    // Lost row: null season_name and null premiere_date → just "Season 3" + "TBA".
    expect(screen.getByText(/^season 3$/i)).toBeInTheDocument();
    expect(screen.getByText(/^TBA$/)).toBeInTheDocument();
  });

  it("Seasons row links to the season episodes page", async () => {
    renderWithProviders(<UpcomingPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /seasons/i }));
    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());

    const link = screen.getByText("Severance").closest("a");
    expect(link).toHaveAttribute("href", "/shows/11/episodes?season=2");
  });

  it("Shows tab renders rows with TBA premiere when null and links to the show", async () => {
    renderWithProviders(<UpcomingPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /shows/i }));

    await waitFor(() => expect(screen.getByText("Brand New")).toBeInTheDocument());
    expect(screen.getByText(/^TBA$/)).toBeInTheDocument();
    const link = screen.getByText("Brand New").closest("a");
    expect(link).toHaveAttribute("href", "/shows/21");
  });
});
