import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ConnectionsTabs } from "./ConnectionsTabs";
import * as connectionsApi from "@/api/connections";

describe("ConnectionsTabs", () => {
  it("renders the tab list with Connections selected by default", async () => {
    const listConnections = vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [],
    });
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsTabs />);

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /connections/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await waitFor(() => expect(listConnections).toHaveBeenCalledTimes(1));
  });

  it("does not fetch the Blocked tab's data until it is viewed", async () => {
    const listConnections = vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    // Requests is fetched eagerly to drive the badge — no longer lazy.
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [],
    });
    const listBlocks = vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsTabs />);

    await waitFor(() => expect(listConnections).toHaveBeenCalled());
    expect(listBlocks).not.toHaveBeenCalled();
  });

  it("switches to Requests tab and shows its content", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [],
    });
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsTabs />);

    fireEvent.click(screen.getByRole("tab", { name: /requests/i }));

    expect(screen.getByRole("tab", { name: /requests/i })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByText(/no incoming requests/i)).toBeInTheDocument());
  });

  it("switches to Blocked tab and fetches its data", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [],
    });
    const listBlocks = vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsTabs />);

    fireEvent.click(screen.getByRole("tab", { name: /blocked/i }));

    await waitFor(() => expect(listBlocks).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/no blocked users/i)).toBeInTheDocument());
  });

  it("badges the Requests sub-tab with the incoming count", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [
        {
          id: "r1",
          requester: { id: "u1", display_name: "U1" },
          addressee: { id: "me", display_name: "Me" },
          state: "pending",
          created_at: new Date().toISOString(),
          responded_at: null,
        },
        {
          id: "r2",
          requester: { id: "u2", display_name: "U2" },
          addressee: { id: "me", display_name: "Me" },
          state: "pending",
          created_at: new Date().toISOString(),
          responded_at: null,
        },
      ],
      outgoing: [],
    });
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsTabs />);

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /requests \(2\)/i })).toBeInTheDocument(),
    );
  });

  it("shows empty-state on the default tab", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [],
    });
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsTabs />);

    await waitFor(() => expect(screen.getByText(/no connections yet/i)).toBeInTheDocument());
  });
});
