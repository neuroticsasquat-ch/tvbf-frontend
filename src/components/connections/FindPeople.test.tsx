import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import * as connectionsApi from "@/api/connections";
import { ApiError } from "@/api/client";
import { FindPeople } from "./FindPeople";

const toastMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastMock(...args), {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastMock(...args),
  }),
}));

describe("FindPeople", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    toastMock.mockReset();
    toastErrorMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("debounces the search by 250ms", async () => {
    const search = vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([]);
    renderWithProviders(<FindPeople />);

    const input = screen.getByRole("searchbox", { name: /find people/i });
    fireEvent.change(input, { target: { value: "ali" } });
    // Below the debounce — no fetch yet.
    expect(search).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(search).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    await waitFor(() => expect(search).toHaveBeenCalledWith("ali"));
  });

  it("does not fetch for queries shorter than 2 chars", async () => {
    const search = vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([]);
    renderWithProviders(<FindPeople />);

    fireEvent.change(screen.getByRole("searchbox", { name: /find people/i }), {
      target: { value: "a" },
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("renders results and lets user send a connect request", async () => {
    vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([
      { id: "u-1", display_name: "Alice" },
    ]);
    const send = vi
      .spyOn(connectionsApi, "sendConnectionRequest")
      .mockResolvedValue({
        id: "r-1",
        requester: { id: "me", display_name: "Me" },
        addressee: { id: "u-1", display_name: "Alice" },
        state: "pending",
        created_at: "2026-05-09T00:00:00Z",
        responded_at: null,
      });

    renderWithProviders(<FindPeople />);
    fireEvent.change(screen.getByRole("searchbox", { name: /find people/i }), {
      target: { value: "ali" },
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() =>
      expect(screen.getByText("Alice")).toBeInTheDocument(),
    );

    const button = screen.getByRole("button", { name: /connect/i });
    fireEvent.click(button);

    await waitFor(() => expect(send).toHaveBeenCalledWith("u-1"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sent/i }),
      ).toBeDisabled(),
    );
  });

  it("toasts and keeps button idle on 409", async () => {
    vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([
      { id: "u-2", display_name: "Bob" },
    ]);
    vi.spyOn(connectionsApi, "sendConnectionRequest").mockRejectedValue(
      new ApiError(409, "connection_exists", { detail: "connection_exists" }),
    );

    renderWithProviders(<FindPeople />);
    fireEvent.change(screen.getByRole("searchbox", { name: /find people/i }), {
      target: { value: "bo" },
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    // Button returns to idle (label still "Connect", not disabled).
    const btn = screen.getByRole("button", { name: /^connect$/i });
    expect(btn).not.toBeDisabled();
  });

  it("shows an empty state when search returns nothing", async () => {
    vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([]);

    renderWithProviders(<FindPeople />);
    fireEvent.change(screen.getByRole("searchbox", { name: /find people/i }), {
      target: { value: "zzz" },
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() =>
      expect(screen.getByText(/no matches/i)).toBeInTheDocument(),
    );
  });
});
