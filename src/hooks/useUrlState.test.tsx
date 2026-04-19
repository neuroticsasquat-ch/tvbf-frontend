import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { useShowFiltersUrlState } from "./useUrlState";

function Harness() {
  const [filters, setFilters] = useShowFiltersUrlState();
  const location = useLocation();
  return (
    <div>
      <div data-testid="search">{filters.search ?? ""}</div>
      <div data-testid="page">{filters.page ?? 1}</div>
      <div data-testid="sort">{filters.sort ?? "name"}</div>
      <div data-testid="genres">{(filters.genre ?? []).join(",")}</div>
      <div data-testid="search-qs">{location.search}</div>
      <button onClick={() => setFilters({ search: "alpha", page: 2 })}>set-search</button>
      <button onClick={() => setFilters({ genre: ["Drama", "Comedy"] })}>set-genres</button>
      <button onClick={() => setFilters({ page: 5 }, { replacePage: false })}>set-page</button>
      <button onClick={() => setFilters({})}>reset</button>
    </div>
  );
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("useShowFiltersUrlState", () => {
  it("parses filters from the URL", () => {
    renderAt("/?search=foo&page=3&sort=-premiered&genre=Drama&genre=Comedy");
    expect(screen.getByTestId("search").textContent).toBe("foo");
    expect(screen.getByTestId("page").textContent).toBe("3");
    expect(screen.getByTestId("sort").textContent).toBe("-premiered");
    expect(screen.getByTestId("genres").textContent).toBe("Drama,Comedy");
  });

  it("resets page to 1 when a non-page filter changes", async () => {
    const user = userEvent.setup();
    renderAt("/?page=5");
    await user.click(screen.getByText("set-search"));
    expect(screen.getByTestId("page").textContent).toBe("2");
  });

  it("drops empty genre arrays from the URL", async () => {
    const user = userEvent.setup();
    renderAt("/?genre=Drama&genre=Comedy");
    await user.click(screen.getByText("reset"));
    expect(screen.getByTestId("genres").textContent).toBe("");
    expect(screen.getByTestId("search-qs").textContent).toBe("");
  });

  it("ignores unknown sort keys", () => {
    renderAt("/?sort=whatever");
    expect(screen.getByTestId("sort").textContent).toBe("name");
  });
});
