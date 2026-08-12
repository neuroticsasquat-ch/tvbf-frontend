/** The specials season reads "Specials" wherever a season is labelled (NEU-1129).
 *
 * `seasonLabel` is unit-tested in `src/lib/season.test.ts`; these tests are
 * about the wiring — that every site which used to build a label out of the
 * season *number* now goes through the helper. The ticket named three sites;
 * the season picker on `EpisodesPage` was a fourth, and is the most prominent
 * place a user meets "Season 0".
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { fixtureShow } from "@/test/msw/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EpisodePage } from "./EpisodePage";
import { EpisodesPage } from "./EpisodesPage";
import { ShowDetailPage } from "./ShowDetailPage";

const base = env.apiBaseUrl;

const SPECIALS = {
  ...fixtureShow.seasons[0],
  id: 1099,
  number: 0,
  name: "Specials",
  premiere_date: null,
};

/** The same show, plus a season 0 named "Specials" and a *named* regular
 * season — production's shape, where TMDB names season 0 and leaves most
 * others as "Season N". */
function showWithSpecials() {
  return {
    ...fixtureShow,
    seasons: [
      { ...fixtureShow.seasons[0], name: "Season 1" },
      { ...fixtureShow.seasons[1], name: "The Final Season" },
      SPECIALS,
    ],
  };
}

function useShowWithSpecials() {
  server.use(http.get(`${base}/shows/:id`, () => HttpResponse.json(showWithSpecials())));
}

describe("the specials season is labelled by name, not number", () => {
  it("ShowDetailPage renders it as Specials", async () => {
    useShowWithSpecials();
    renderWithProviders(
      <Routes>
        <Route path="/shows/:id" element={<ShowDetailPage />} />
      </Routes>,
      { route: "/shows/100" },
    );

    await waitFor(() => expect(screen.getByRole("link", { name: /Specials/ })).toBeInTheDocument());
    expect(screen.queryByText(/Season 0/)).not.toBeInTheDocument();
  });

  it("ShowDetailPage still shows an unnamed season by its number", async () => {
    // The fixture's own seasons carry `name: null` — the 5 unnamed season-0
    // rows in production take this path too.
    renderWithProviders(
      <Routes>
        <Route path="/shows/:id" element={<ShowDetailPage />} />
      </Routes>,
      { route: "/shows/100" },
    );

    await waitFor(() => expect(screen.getByRole("link", { name: /Season 1/ })).toBeInTheDocument());
  });

  it("ShowDetailPage shows a named regular season by its name", async () => {
    useShowWithSpecials();
    renderWithProviders(
      <Routes>
        <Route path="/shows/:id" element={<ShowDetailPage />} />
      </Routes>,
      { route: "/shows/100" },
    );

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /The Final Season/ })).toBeInTheDocument(),
    );
  });

  it("the EpisodesPage season picker offers Specials rather than Season 0", async () => {
    useShowWithSpecials();
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/shows/:id/episodes" element={<EpisodesPage />} />
      </Routes>,
      { route: "/shows/100/episodes" },
    );

    await waitFor(() => expect(screen.getByText("Pilot")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /select season/i }));

    expect(await screen.findByRole("button", { name: "Specials" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Season 0" })).not.toBeInTheDocument();
  });

  it("the EpisodesPage heading reads Specials when season 0 is selected", async () => {
    useShowWithSpecials();
    renderWithProviders(
      <Routes>
        <Route path="/shows/:id/episodes" element={<EpisodesPage />} />
      </Routes>,
      { route: "/shows/100/episodes?season=0" },
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /select season \(current: Specials\)/i }),
      ).toBeInTheDocument(),
    );
  });

  it("EpisodePage's back-link reads Specials for an episode in season 0", async () => {
    useShowWithSpecials();
    server.use(
      http.get(`${base}/episodes/:id`, () =>
        HttpResponse.json({
          id: 7001,
          show_id: 100,
          season_id: 1099,
          season: 0,
          number: 1,
          name: "A Christmas Special",
          airdate: "2020-12-25",
          airtime: null,
          runtime: 45,
          summary: null,
          image_medium: null,
          image_original: null,
          watched: null,
          rating_average: null,
          my_rating: null,
        }),
      ),
    );
    renderWithProviders(
      <Routes>
        <Route path="/episodes/:episodeId" element={<EpisodePage />} />
      </Routes>,
      { route: "/episodes/7001" },
    );

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Back to Specials/i })).toBeInTheDocument(),
    );
  });
});
