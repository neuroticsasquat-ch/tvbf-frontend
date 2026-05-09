import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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
    user: { id, display_name: name },
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
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([
      makeBlock("u-1", "Alice"),
    ]);
    const unblock = vi
      .spyOn(connectionsApi, "unblockUser")
      .mockResolvedValue(undefined);

    renderWithProviders(<BlockedList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(unblock).not.toHaveBeenCalled();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("removes the row optimistically when confirmed", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([
      makeBlock("u-1", "Alice"),
    ]);
    const unblock = vi
      .spyOn(connectionsApi, "unblockUser")
      .mockResolvedValue(undefined);

    renderWithProviders(<BlockedList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(unblock).toHaveBeenCalledWith("u-1"));
    await waitFor(() =>
      expect(screen.queryByText("Alice")).not.toBeInTheDocument(),
    );
  });

  it("restores the row and toasts on error", async () => {
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([
      makeBlock("u-1", "Alice"),
    ]);
    vi.spyOn(connectionsApi, "unblockUser").mockRejectedValue(
      new ApiError(500, "boom", null),
    );

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
    await waitFor(() =>
      expect(screen.getByText(/no blocked users/i)).toBeInTheDocument(),
    );
  });
});
