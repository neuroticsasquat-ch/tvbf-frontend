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

  // The credit is a CC BY-SA 4.0 condition, not a courtesy: production still
  // serves 782,161 episodes and 18,341 seasons whose data came from TV Maze —
  // the rows the migration deliberately kept because TMDB had no counterpart to
  // map them onto, 189 of them carrying watch history. It comes out when that
  // residue is mapped away, and not before.
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
