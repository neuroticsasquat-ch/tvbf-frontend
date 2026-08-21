import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import * as connectionsApi from "@/api/connections";
import { ApiError } from "@/api/client";
import { BlockedList } from "./BlockedList";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(() => undefined, {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: () => undefined,
  }),
}));

function makeBlock(id: string, name: string) {
  return {
    user: { id, display_name: name, handle: name.toLowerCase().replace(/[^a-z0-9]+/g, "_") },
    blocked_at: "2026-04-01T00:00:00Z",
  };
}

describe("BlockedList", () => {
  beforeEach(() => {
    toastErrorMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders blocked rows with Unblock buttons", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([
      makeBlock("u-1", "Alice"),
      makeBlock("u-2", "Bob"),
    ]);
    renderWithProviders(<BlockedList />);

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /unblock/i })).toHaveLength(2);
  });

  it("opens confirm dialog and keeps row when canceled", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([makeBlock("u-1", "Alice")]);
    const unblock = vi.spyOn(connectionsApi, "unblockUser").mockResolvedValue(undefined);

    renderWithProviders(<BlockedList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(unblock).not.toHaveBeenCalled();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("removes the row optimistically when confirmed", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([makeBlock("u-1", "Alice")]);
    const unblock = vi.spyOn(connectionsApi, "unblockUser").mockResolvedValue(undefined);

    renderWithProviders(<BlockedList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(unblock).toHaveBeenCalledWith("u-1"));
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
  });

  it("restores the row and toasts on error", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([makeBlock("u-1", "Alice")]);
    vi.spyOn(connectionsApi, "unblockUser").mockRejectedValue(new ApiError(500, "boom", null));

    renderWithProviders(<BlockedList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);
    renderWithProviders(<BlockedList />);
    await waitFor(() => expect(screen.getByText(/no blocked users/i)).toBeInTheDocument());
  });

  it("reports a blocked user without re-offering the block", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([makeBlock("u-1", "Alice")]);
    renderWithProviders(<BlockedList />);
    const user = userEvent.setup();

    // Blocking is private; reporting is the escalation from it (NEU-1168 §2).
    await user.click(await screen.findByRole("button", { name: "Report Alice (@alice)" }));
    await user.type(screen.getByLabelText(/what happened/i), "Still contacting me elsewhere.");
    await user.click(screen.getByRole("button", { name: /send report/i }));
    await screen.findByText(/report received/i);

    // `canBlock={false}` — offering an action the app knows is pointless is the
    // small dishonesty AC 5 exists against.
    expect(screen.queryByRole("button", { name: /block Alice/i })).not.toBeInTheDocument();
    expect(screen.getByText(/already blocked Alice/i)).toBeInTheDocument();
  });

  it("draws each blocked user through UserIdentity", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([makeBlock("u-1", "Alice")]);
    renderWithProviders(<BlockedList />);

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    const identity = document.querySelector("[data-user-identity]");
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent("@alice");
  });

  it("names both the display name and the handle in the unblock confirmation", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([makeBlock("u-1", "Alice")]);
    renderWithProviders(<BlockedList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    expect(await screen.findByText(/Unblock Alice \(@alice\)\?/)).toBeInTheDocument();
  });
});
