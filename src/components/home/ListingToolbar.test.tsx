import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/renderWithProviders";
import { ListingToolbar } from "./ListingToolbar";

const SORTS = [
  { key: "name_asc", label: "Show Title" },
  { key: "airdate_asc", label: "Next Air Date" },
] as const;

function renderToolbar(props: Partial<Parameters<typeof ListingToolbar>[0]> = {}) {
  return renderWithProviders(
    <ListingToolbar
      sort={{ label: "Upcoming", options: SORTS, value: "name_asc", onChange: vi.fn() }}
      filters={<button type="button">a filter</button>}
      {...props}
    />,
  );
}

describe("ListingToolbar (NEU-1189)", () => {
  it("puts the view toggle before the sort control", () => {
    const { container } = renderToolbar({
      view: { value: "list", onChange: vi.fn(), ariaLabel: "My Shows display" },
    });
    const toggle = screen.getByRole("group", { name: "My Shows display" });
    const sort = screen.getByRole("button", { name: /^Sort Upcoming/ });
    // `compareDocumentPosition` reads the rendered order rather than the source
    // order, which is what a user's eye follows.
    expect(toggle.compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector(".ml-auto")).toBeNull();
  });

  it("puts the filters after the sort control, on their own row", () => {
    renderToolbar();
    const sort = screen.getByRole("button", { name: /^Sort Upcoming/ });
    const filter = screen.getByRole("button", { name: "a filter" });
    expect(sort.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sort.closest("div")).not.toBe(filter.closest("div"));
  });

  it("omits the view toggle entirely when the page has none", () => {
    renderToolbar();
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("button", { name: "Grid view" })).toBeNull();
  });

  it("derives both the sheet heading and the trigger name from one label", async () => {
    renderToolbar();
    // The trigger names the surface *and* the current value, so a screen reader
    // gets the state without opening the sheet.
    await userEvent.click(
      screen.getByRole("button", { name: "Sort Upcoming (current: Show Title)" }),
    );
    expect(screen.getByText("Sort Upcoming")).toBeInTheDocument();
  });

  it("renders no filter row when a surface passes none", () => {
    const { container } = renderToolbar({ filters: undefined });
    // One row, not an empty second one leaving a stray `mb-4` gap.
    expect(container.querySelectorAll("div.flex.flex-wrap")).toHaveLength(1);
  });
});
