import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "./ConfirmDialog";

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      title="Block user"
      description="Block Alice? This removes the connection."
      onConfirm={onConfirm}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onConfirm, onClose };
}

/** The four behaviours the promotion to `ui/dialog` buys (NEU-1168 §5). The
 * version this replaced was a hand-rolled `role="dialog"` overlay with none of
 * them, and the admin confirmations are exactly the ceremony AC 2 is about. */
describe("ConfirmDialog", () => {
  it("is labelled by its title, described by its body, and takes focus", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog", { name: "Block user" });
    expect(dialog).toHaveAccessibleDescription("Block Alice? This removes the connection.");
    // Focus moves into the dialog on open, which is the half of the focus trap
    // observable without a trigger to restore to.
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
  });

  it("closes on Escape without confirming", async () => {
    const { onConfirm, onClose } = renderDialog();
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("reports Cancel and Confirm through their own callbacks", async () => {
    const { onConfirm, onClose } = renderDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("disables confirmation while the caller's mutation is in flight", async () => {
    renderDialog({ pending: true, confirmLabel: "Disable account" });
    expect(await screen.findByRole("button", { name: "Disable account" })).toBeDisabled();
  });
});
