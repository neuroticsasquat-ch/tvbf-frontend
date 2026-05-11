import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import * as connectionsApi from "@/api/connections";
import { ApiError } from "@/api/client";
import { RequestsInbox } from "./RequestsInbox";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(() => undefined, {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: () => undefined,
  }),
}));

function makeReq(
  id: string,
  other: { id: string; display_name: string },
  side: "incoming" | "outgoing",
  callerId = "me",
) {
  return {
    id,
    requester: side === "incoming" ? other : { id: callerId, display_name: "Me" },
    addressee: side === "incoming" ? { id: callerId, display_name: "Me" } : other,
    state: "pending" as const,
    created_at: "2026-05-08T12:00:00Z",
    responded_at: null,
  };
}

describe("RequestsInbox", () => {
  beforeEach(() => {
    toastErrorMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Incoming and Outgoing sections with rows", async () => {
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [makeReq("r-in", { id: "u-1", display_name: "Alice" }, "incoming")],
      outgoing: [makeReq("r-out", { id: "u-2", display_name: "Bob" }, "outgoing")],
    });

    renderWithProviders(<RequestsInbox />);

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /incoming/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /outgoing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("optimistically removes a row on Accept", async () => {
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [makeReq("r-in", { id: "u-1", display_name: "Alice" }, "incoming")],
      outgoing: [],
    });
    const accept = vi
      .spyOn(connectionsApi, "acceptConnectionRequest")
      .mockResolvedValue(makeReq("r-in", { id: "u-1", display_name: "Alice" }, "incoming"));

    renderWithProviders(<RequestsInbox />);

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith("r-in"));
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
  });

  it("optimistically removes a row on Reject", async () => {
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [makeReq("r-in", { id: "u-1", display_name: "Alice" }, "incoming")],
      outgoing: [],
    });
    const del = vi.spyOn(connectionsApi, "deleteConnectionRequest").mockResolvedValue(undefined);

    renderWithProviders(<RequestsInbox />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("r-in"));
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
  });

  it("optimistically removes a row on Cancel", async () => {
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [makeReq("r-out", { id: "u-2", display_name: "Bob" }, "outgoing")],
    });
    const del = vi.spyOn(connectionsApi, "deleteConnectionRequest").mockResolvedValue(undefined);

    renderWithProviders(<RequestsInbox />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("r-out"));
    await waitFor(() => expect(screen.queryByText("Bob")).not.toBeInTheDocument());
  });

  it("restores the row and toasts on error", async () => {
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [makeReq("r-in", { id: "u-1", display_name: "Alice" }, "incoming")],
      outgoing: [],
    });
    vi.spyOn(connectionsApi, "acceptConnectionRequest").mockRejectedValue(
      new ApiError(500, "boom", null),
    );

    renderWithProviders(<RequestsInbox />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    // After the rejection rolls back, the row remains visible and an error toast fires.
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("blocks the requester from an incoming row", async () => {
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [makeReq("r-in", { id: "u-1", display_name: "Alice" }, "incoming")],
      outgoing: [],
    });
    const block = vi.spyOn(connectionsApi, "blockUser").mockResolvedValue({
      user: { id: "u-1", display_name: "Alice" },
      blocked_at: "2026-05-09T00:00:00Z",
    });

    renderWithProviders(<RequestsInbox />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^block$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(block).toHaveBeenCalledWith("u-1"));
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
  });

  it("renders empty state for both sections when no requests", async () => {
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [],
    });

    renderWithProviders(<RequestsInbox />);
    await waitFor(() => expect(screen.getByText(/no incoming requests/i)).toBeInTheDocument());
    expect(screen.getByText(/no outgoing requests/i)).toBeInTheDocument();
  });
});
