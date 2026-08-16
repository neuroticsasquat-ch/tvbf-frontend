import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AppShell } from "./AppShell";

// TMDB's attribution terms require this sentence verbatim. Do not reword it —
// see NEU-1049 and https://www.themoviedb.org/about/logos-attribution.
const TMDB_NOTICE = "This product uses the TMDB API but is not endorsed or certified by TMDB.";

function footer() {
  renderWithProviders(<AppShell />);
  return within(screen.getByRole("contentinfo"));
}

describe("AppShell footer attribution", () => {
  it("carries the TMDB notice verbatim", () => {
    expect(footer().getByText(TMDB_NOTICE, { exact: false })).toBeInTheDocument();
  });

  it("serves the TMDB logo from our own origin and links it to themoviedb.org", () => {
    const logo = footer().getByRole("img", { name: /the movie database \(tmdb\)/i });
    expect(logo).toHaveAttribute("src", "/tmdb-logo.svg");
    expect(logo.closest("a")).toHaveAttribute("href", "https://www.themoviedb.org");
  });

  // This assertion has now been inverted twice, which is the point of keeping it
  // rather than deleting it either time. It pinned the credit's presence until
  // NEU-1146 retired the last TV Maze-derived catalog rows, its absence from
  // NEU-1147, and its presence again now: NEU-1145 re-admitted a TV Maze-derived
  // value — the per-season airdate offset — and CC BY-SA attribution follows the
  // derived value, not the volume of it.
  it("credits TVmaze under CC BY-SA while airdate corrections are derived from it", () => {
    const inFooter = footer();
    expect(inFooter.getByRole("link", { name: "TVmaze" })).toHaveAttribute(
      "href",
      "https://www.tvmaze.com",
    );
    expect(inFooter.getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/",
    );
  });

  // The two attributions are separate lines, not one sentence: TMDB's required
  // notice must not read as though the TVmaze clause qualifies it.
  it("keeps the TVmaze credit out of the TMDB notice's own paragraph", () => {
    const tmdbParagraph = footer().getByText(TMDB_NOTICE, { exact: false });
    expect(within(tmdbParagraph).queryByRole("link", { name: "TVmaze" })).not.toBeInTheDocument();
  });
});

describe("AppShell footer publisher line", () => {
  // Product name, product casing. The lowercase form is backlotter's house
  // style and does not travel with the wording.
  it("carries a copyright for the product, not the legal entity", () => {
    const year = new Date().getFullYear();
    expect(footer().getByText(`© ${year} TV BingeFriend.`)).toBeInTheDocument();
  });

  it("credits the neuroticsasquat.ch release and links to it", () => {
    const link = footer().getByRole("link", { name: /neuroticsasquat\.ch/i });
    expect(link).toHaveAttribute("href", "https://neuroticsasquat.ch");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("inlines the sasquatch mark so it inherits the footer text colour", () => {
    const mark = footer().getByRole("img", { name: "neuroticsasquat.ch" });
    // Inline `<svg>`, never an `<img src>` — `currentColor` has nothing to
    // inherit in an image document and would render the mark black on a dark
    // footer. If this ever becomes an <img>, the dark theme breaks silently.
    expect(mark.tagName.toLowerCase()).toBe("svg");
    expect(mark).not.toHaveAttribute("src");
  });
});

describe("AppShell primary nav", () => {
  // Both the desktop header nav and the mobile bottom bar render the same
  // primaryLinks() and carry aria-label="Primary", so there are always two.
  async function primaryNavs() {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({
          id: "u1",
          email: "a@b.com",
          display_name: "A",
          created_at: new Date().toISOString(),
        }),
      ),
      http.get(`${env.apiBaseUrl}/me/connection-requests`, () =>
        HttpResponse.json({ incoming: [], outgoing: [] }),
      ),
    );
    renderWithProviders(<AppShell />);
    return await screen.findAllByRole("navigation", { name: "Primary" });
  }

  it("links Discover at /discover", async () => {
    const [desktop] = await primaryNavs();
    expect(within(desktop).getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/discover",
    );
  });

  // Position, not just presence: NEU-1113 and the M5 contract both place
  // Discover immediately after Upcoming. "Fifth nav item" in the spec is the
  // count the mobile bottom bar has to carry, not the slot.
  it("places Discover immediately after Upcoming, five items in all", async () => {
    const [desktop] = await primaryNavs();
    const hrefs = within(desktop)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/upcoming", "/discover", "/my-shows", "/friends"]);
  });

  // The bottom bar is the placement the five-item ceiling was accepted for, so
  // it carries the same five rather than a subset.
  it("carries the same five items in the mobile bottom bar", async () => {
    const navs = await primaryNavs();
    const bottom = navs[navs.length - 1];
    const hrefs = within(bottom)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/", "/upcoming", "/discover", "/my-shows", "/friends"]);
  });
});
