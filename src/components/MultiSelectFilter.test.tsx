import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MultiSelectFilter } from "./MultiSelectFilter";

const options = [
  { value: "Drama", label: "Drama" },
  { value: "Comedy", label: "Comedy" },
  { value: "Sci-Fi", label: "Sci-Fi" },
];

describe("MultiSelectFilter", () => {
  it("renders placeholder when nothing is selected", () => {
    render(
      <MultiSelectFilter
        label="Genres"
        placeholder="Any genre"
        options={options}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: /genres/i })).toHaveTextContent("Any genre");
  });

  it("toggles a value on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelectFilter
        label="Genres"
        options={options}
        selected={[]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: /genres/i }));
    await user.click(await screen.findByRole("option", { name: "Drama" }));
    expect(onChange).toHaveBeenCalledWith(["Drama"]);
  });

  it("deselects an already-selected value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelectFilter
        label="Genres"
        options={options}
        selected={["Drama"]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: /genres/i }));
    await user.click(await screen.findByRole("option", { name: "Drama" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows a 'N selected' summary when more than 2 are chosen", () => {
    render(
      <MultiSelectFilter
        label="Genres"
        options={options}
        selected={["Drama", "Comedy", "Sci-Fi"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: /genres/i })).toHaveTextContent("3 selected");
  });

  it("clear-selection button resets to empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelectFilter
        label="Genres"
        options={options}
        selected={["Drama"]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: /genres/i }));
    await user.click(await screen.findByRole("button", { name: /clear selection/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
