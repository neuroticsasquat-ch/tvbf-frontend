import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { FeedbackDialog } from "./FeedbackDialog";

function renderDialog(onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <Toaster />
      <FeedbackDialog open={true} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { ...utils, onOpenChange };
}

describe("FeedbackDialog", () => {
  it("submits subject + body and closes on success", async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/subject/i), "A subject");
    await user.type(screen.getByLabelText(/details/i), "Some details about the bug.");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
  });

  it("disables submit until both fields have content", async () => {
    renderDialog();
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: /send/i });

    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText(/subject/i), "Only a subject");
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText(/details/i), "Now with body");
    expect(send).toBeEnabled();
  });
});
