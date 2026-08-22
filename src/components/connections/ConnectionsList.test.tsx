import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import * as connectionsApi from "@/api/connections";
import { ApiError } from "@/api/client";
import { ConnectionsList } from "./ConnectionsList";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(() => undefined, {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: () => undefined,
  }),
}));

function makeConn(id: string, name: string) {
  return {
    user: { id, display_name: name, handle: name.toLowerCase().replace(/[^a-z0-9]+/g, "_") },
    since: "2026-04-01T00:00:00Z",
  };
}

describe("ConnectionsList", () => {
  beforeEach(() => {
    toastErrorMock.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders rows and a Remove control per connection", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([
      makeConn("u-1", "Alice"),
      makeConn("u-2", "Bob"),
    ]);
    renderWithProviders(<ConnectionsList />);

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(2);
  });

  it("opens confirm dialog and keeps row when canceled", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([makeConn("u-1", "Alice")]);
    const remove = vi.spyOn(connectionsApi, "removeConnection").mockResolvedValue(undefined);

    renderWithProviders(<ConnectionsList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("removes the row optimistically when confirmed", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([makeConn("u-1", "Alice")]);
    const remove = vi.spyOn(connectionsApi, "removeConnection").mockResolvedValue(undefined);

    renderWithProviders(<ConnectionsList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("u-1"));
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
  });

  it("restores the row and toasts on error", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([makeConn("u-1", "Alice")]);
    vi.spyOn(connectionsApi, "removeConnection").mockRejectedValue(new ApiError(500, "boom", null));

    renderWithProviders(<ConnectionsList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("blocks a user from the connection row", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([
      {
        user: { id: "u-1", display_name: "Alice", handle: "alice" },
        since: "2026-04-01T00:00:00Z",
      },
    ]);
    const block = vi.spyOn(connectionsApi, "blockUser").mockResolvedValue({
      user: { id: "u-1", display_name: "Alice", handle: "alice" },
      blocked_at: "2026-05-09T00:00:00Z",
    });

    renderWithProviders(<ConnectionsList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^block$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(block).toHaveBeenCalledWith("u-1"));
    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
  });

  it("renders empty state pointing at user search", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    renderWithProviders(<ConnectionsList />);
    await waitFor(() => expect(screen.getByText(/find people/i)).toBeInTheDocument());
  });

  it("carries a report control per row — the row is a person, not a byline", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([
      makeConn("u-1", "Alice"),
      makeConn("u-2", "Bob"),
    ]);
    renderWithProviders(<ConnectionsList />);

    // The flow itself is `ReportUserButton`'s to test (NEU-1168 §6); this
    // asserts only that the surface renders it, named per person.
    expect(
      await screen.findByRole("button", { name: "Report Alice (@alice)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report Bob (@bob)" })).toBeInTheDocument();
  });

  // The tripwire, not the text (NEU-1169 §7): `UserIdentity.test.tsx` owns the
  // layout, and this asserts only that the row goes through it. A test looking
  // for `@alice` on screen passes just as happily when this row hand-rolls its
  // own span and drifts from the shared shape.
  it("draws each connection through UserIdentity", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([makeConn("u-1", "Alice")]);
    renderWithProviders(<ConnectionsList />);

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    const identity = document.querySelector("[data-user-identity]");
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent("Alice");
    expect(identity).toHaveTextContent("@alice");
  });

  it("names both the display name and the handle in the destructive confirmations", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([makeConn("u-1", "Alice")]);
    renderWithProviders(<ConnectionsList />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(await screen.findByText(/Disconnect from Alice \(@alice\)\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    fireEvent.click(screen.getByRole("button", { name: /block/i }));
    expect(await screen.findByText(/Block Alice \(@alice\)\?/)).toBeInTheDocument();
  });
});
