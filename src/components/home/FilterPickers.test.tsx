import { describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { GenreFilter } from "@/components/home/FilterPickers";
import { renderWithProviders } from "@/test/renderWithProviders";

// `fixtureGenres` serves Drama / Comedy / Sci-Fi from the default MSW handler.

describe("GenreFilter", () => {
  it("clears a persisted genre the catalog no longer carries", async () => {
    // `usePersistedString` restores its value with no validation at all, so a
    // genre from a retired vocabulary comes back verbatim and filters every
    // list to empty while the picker still reads as a valid choice
    // (NEU-1031 D3). The genre list is served by the API rather than being a
    // constant, so the picker is the only place that can tell.
    const onChange = vi.fn();
    renderWithProviders(<GenreFilter value="Supernatural" onChange={onChange} />);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("all"));
  });

  it("leaves a genre the catalog still carries alone", async () => {
    const onChange = vi.fn();
    const { findByRole } = renderWithProviders(<GenreFilter value="Drama" onChange={onChange} />);

    await findByRole("button", { name: /current: Drama/i });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not clear before the genre list has loaded", async () => {
    // `data` undefined means "not known yet", not "not a genre" — clearing on
    // it would wipe the filter on every mount.
    const onChange = vi.fn();
    renderWithProviders(<GenreFilter value="Drama" onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("never clears 'all', which is the picker's own key rather than a genre", async () => {
    const onChange = vi.fn();
    const { findByRole } = renderWithProviders(<GenreFilter value="all" onChange={onChange} />);

    await findByRole("button", { name: /current: All/i });
    expect(onChange).not.toHaveBeenCalled();
  });
});
