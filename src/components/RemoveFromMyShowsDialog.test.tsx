import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/renderWithProviders";
import { RemoveFromMyShowsDialog } from "./RemoveFromMyShowsDialog";

describe("RemoveFromMyShowsDialog", () => {
  it("names the show and says what a removal keeps", () => {
    // NEU-1511 D6: the watch-history dialog one tab over says "This cannot be
    // undone", and this one must not read the same.
    renderWithProviders(
      <RemoveFromMyShowsDialog
        showName="The Bear"
        pending={false}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Remove from My Shows" });
    expect(dialog).toHaveTextContent(
      "Remove The Bear from My Shows? Your watch history and rating are kept.",
    );
  });

  it("calls through on Remove and on Cancel", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <RemoveFromMyShowsDialog
        showName="The Bear"
        pending={false}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
