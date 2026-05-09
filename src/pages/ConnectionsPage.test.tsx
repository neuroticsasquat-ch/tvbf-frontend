import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ConnectionsPage } from "./ConnectionsPage";
import * as connectionsApi from "@/api/connections";

describe("ConnectionsPage shell", () => {
  it("renders the page heading and tab list", async () => {
    const listConnections = vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [],
    });
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsPage />);

    expect(screen.getByRole("heading", { name: /connections/i, level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /connections/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await waitFor(() => expect(listConnections).toHaveBeenCalledTimes(1));
  });

  it("does not fetch other tabs' data until they are viewed", async () => {
    const listConnections = vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    const listRequests = vi
      .spyOn(connectionsApi, "listConnectionRequests")
      .mockResolvedValue({ incoming: [], outgoing: [] });
    const listBlocks = vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsPage />);

    await waitFor(() => expect(listConnections).toHaveBeenCalled());
    expect(listRequests).not.toHaveBeenCalled();
    expect(listBlocks).not.toHaveBeenCalled();
  });

  it("switches to Requests tab and fetches its data", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    const listRequests = vi
      .spyOn(connectionsApi, "listConnectionRequests")
      .mockResolvedValue({ incoming: [], outgoing: [] });
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsPage />);

    fireEvent.click(screen.getByRole("tab", { name: /requests/i }));

    await waitFor(() => expect(listRequests).toHaveBeenCalledTimes(1));
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

    renderWithProviders(<ConnectionsPage />);

    fireEvent.click(screen.getByRole("tab", { name: /blocked/i }));

    await waitFor(() => expect(listBlocks).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/no blocked users/i)).toBeInTheDocument());
  });

  it("shows empty-state on the default tab", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    vi.spyOn(connectionsApi, "listConnectionRequests").mockResolvedValue({
      incoming: [],
      outgoing: [],
    });
    vi.spyOn(connectionsApi, "listBlocks").mockResolvedValue([]);

    renderWithProviders(<ConnectionsPage />);

    await waitFor(() => expect(screen.getByText(/no connections yet/i)).toBeInTheDocument());
  });
});
