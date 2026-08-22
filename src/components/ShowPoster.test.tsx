import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowPoster } from "./ShowPoster";

/** The corner rule is asserted **once, here** (NEU-1183 AC 1-3). Every surface
 * renders through this component, so placement is inherited rather than
 * restated per card — which is the property that stops the two marks drifting
 * apart again. Each surface's own test asserts only that it goes through here.
 */
describe("ShowPoster", () => {
  it("puts the library mark in the top-left corner", () => {
    renderWithProviders(
      <ShowPoster to="/shows/1" src={null} linkLabel="Silo" size="card" inMyShows />,
    );
    const mark = screen.getByRole("img", { name: "In your My Shows" });
    expect(mark.className).toContain("top-1");
    expect(mark.className).toContain("left-1");
    expect(mark.className).not.toContain("right-1");
  });

  it("puts the viewer's own rating in the top-right corner", () => {
    renderWithProviders(
      <ShowPoster to="/shows/1" src={null} linkLabel="Silo" size="card" ownRating={4.5} />,
    );
    const badge = screen.getByRole("img", { name: "Your rating: 4.5 out of 5" });
    expect(badge.className).toContain("top-1");
    expect(badge.className).toContain("right-1");
    expect(badge.className).not.toContain("bottom-1");
  });

  it("keeps the two facts in opposite top corners on one poster", () => {
    // The defect this ticket ends: both marks moved between Discover and My
    // Shows, and they traded places diagonally, so nothing on a card was a
    // stable landmark.
    renderWithProviders(
      <ShowPoster
        to="/shows/1"
        src="https://img.example/poster.jpg"
        linkLabel="Silo"
        size="card"
        inMyShows
        ownRating={3.5}
      />,
    );
    expect(screen.getByRole("img", { name: "In your My Shows" }).className).toContain("left-1");
    expect(screen.getByRole("img", { name: "Your rating: 3.5 out of 5" }).className).toContain(
      "right-1",
    );
  });

  it("keeps both fact badges hoverable, inside the link rather than under an inert layer", () => {
    // Their `title` tooltip is the sighted half of the rating vocabulary
    // (NEU-1182 §4.3), and a tap on a poster corner still navigates. Both are
    // properties of the badges being descendants of the link, which is legal
    // for a `<span>` and is exactly what a `<button>` may not be.
    renderWithProviders(
      <ShowPoster
        to="/shows/1"
        src={null}
        linkLabel="Silo"
        size="card"
        inMyShows
        ownRating={4.5}
      />,
    );
    for (const name of ["In your My Shows", "Your rating: 4.5 out of 5"]) {
      const badge = screen.getByRole("img", { name });
      expect(badge).toHaveAttribute("title");
      expect(badge.closest("a")).not.toBeNull();
    }
  });

  it("puts a control in the bottom-right corner", () => {
    renderWithProviders(
      <ShowPoster
        to="/shows/1"
        src={null}
        linkLabel="Silo"
        size="card"
        control={<button type="button">Dismiss</button>}
      />,
    );
    const slot = screen.getByRole("button", { name: "Dismiss" }).parentElement;
    expect(slot?.className).toContain("bottom-0");
    expect(slot?.className).toContain("right-0");
  });

  it("keeps a control outside the poster's link", () => {
    // A `<button>` inside an `<a>` is invalid nesting and a real focus-order
    // problem (NEU-1179 §3.2). Owning the link here is what makes every overlay
    // slot a sibling of it by construction rather than by each card's care.
    renderWithProviders(
      <ShowPoster
        to="/shows/1"
        src={null}
        linkLabel="Silo"
        size="card"
        control={<button type="button">Dismiss</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Dismiss" }).closest("a")).toBeNull();
  });

  it("renders no corner a caller did not ask for", () => {
    renderWithProviders(<ShowPoster to="/shows/1" src={null} linkLabel="Silo" size="card" />);
    expect(screen.queryByRole("img", { name: "In your My Shows" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /rating:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders no rating badge for a zero rating", () => {
    renderWithProviders(
      <ShowPoster to="/shows/1" src={null} linkLabel="Silo" size="card" ownRating={0} />,
    );
    expect(screen.queryByRole("img", { name: /rating:/ })).not.toBeInTheDocument();
  });

  it("renders the same fallback for a missing image on every size", () => {
    // The markup existed three times with two behaviours: the cards fell back
    // to this data URI, the list rows to a `bg-muted` div. All four surfaces
    // now render the same absence.
    const { unmount } = renderWithProviders(
      <ShowPoster to="/shows/1" src={null} linkLabel="Silo" size="card" />,
    );
    const card = screen.getByRole("link", { name: "Silo" }).querySelector("img");
    expect(card?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    unmount();

    renderWithProviders(<ShowPoster to="/shows/1" src={null} linkLabel="Silo" size="row" />);
    const row = screen.getByRole("link", { name: "Silo" }).querySelector("img");
    expect(row?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("renders the show's own image when it has one", () => {
    renderWithProviders(
      <ShowPoster
        to="/shows/1"
        src="https://img.example/poster.jpg"
        linkLabel="Silo"
        size="card"
      />,
    );
    const img = screen.getByRole("link", { name: "Silo" }).querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://img.example/poster.jpg");
  });

  it("links to the show, named for it", () => {
    renderWithProviders(<ShowPoster to="/shows/42" src={null} linkLabel="Silo" size="row" />);
    expect(screen.getByRole("link", { name: "Silo" })).toHaveAttribute("href", "/shows/42");
  });

  describe("presentational form (NEU-1190 §1.3)", () => {
    it("renders no link at all when the pair is omitted", () => {
      renderWithProviders(<ShowPoster src={null} size="row" />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("keeps both fact badges in the accessibility tree, with their labels", () => {
      // The whole reason the poster drops its link rather than being
      // `aria-hidden`: hiding the subtree would delete these two from the
      // accessibility tree on every row, trading one a11y defect for a worse
      // one.
      renderWithProviders(<ShowPoster src={null} size="row" inMyShows ownRating={4.5} />);
      expect(screen.getByRole("img", { name: "In your My Shows" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Your rating: 4.5 out of 5" })).toBeInTheDocument();
    });

    it("keeps the corner rule and the fallback image", () => {
      const { container } = renderWithProviders(
        <ShowPoster src={null} size="row" inMyShows ownRating={3.5} />,
      );
      expect(screen.getByRole("img", { name: "In your My Shows" }).className).toContain("left-1");
      expect(screen.getByRole("img", { name: "Your rating: 3.5 out of 5" }).className).toContain(
        "right-1",
      );
      expect(container.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    });

    it("still places a control in the bottom-right, outside any link", () => {
      // `ActiveRow`'s compact My Shows chip rides a presentational poster, and
      // the control layer is a sibling of the link either way — so dropping
      // the link changes nothing about it.
      renderWithProviders(
        <ShowPoster src={null} size="row" control={<button type="button">Remove</button>} />,
      );
      const control = screen.getByRole("button", { name: "Remove" });
      expect(control.parentElement?.className).toContain("bottom-0");
      expect(control.parentElement?.className).toContain("right-0");
      expect(control.closest("a")).toBeNull();
    });

    it("refuses half a link at the type level", () => {
      // AC 3. `to` and `linkLabel` are jointly optional, so a caller cannot
      // keep one while dropping the other — which is what would go stale.
      // @ts-expect-error `to` without `linkLabel`
      const withoutLabel = <ShowPoster to="/shows/1" src={null} size="row" />;
      // @ts-expect-error `linkLabel` without `to`
      const withoutTo = <ShowPoster linkLabel="Silo" src={null} size="row" />;
      expect(withoutLabel).toBeTruthy();
      expect(withoutTo).toBeTruthy();
    });
  });
});
