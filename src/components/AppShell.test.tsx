import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
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

  it("keeps the TVmaze CC BY-SA credit while TV Maze-derived data is still served", () => {
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
});
