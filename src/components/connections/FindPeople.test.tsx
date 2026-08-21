import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { meHandler, VERIFIED_AT } from "@/test/msw/me";
import { renderWithProviders } from "@/test/renderWithProviders";
import * as connectionsApi from "@/api/connections";
import { ApiError } from "@/api/client";
import { BANNER_DISMISS_KEY } from "@/lib/verification";
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
      { id: "u-1", display_name: "Alice", handle: "alice" },
    ]);
    const send = vi.spyOn(connectionsApi, "sendConnectionRequest").mockResolvedValue({
      id: "r-1",
      requester: { id: "me", display_name: "Me", handle: "me_user" },
      addressee: { id: "u-1", display_name: "Alice", handle: "alice" },
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
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    const button = screen.getByRole("button", { name: /connect/i });
    fireEvent.click(button);

    await waitFor(() => expect(send).toHaveBeenCalledWith("u-1"));
    await waitFor(() => expect(screen.getByRole("button", { name: /sent/i })).toBeDisabled());
  });

  it("toasts and keeps button idle on 409", async () => {
    vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([{ id: "u-2", display_name: "Bob", handle: "bob" }]);
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

    await waitFor(() => expect(screen.getByText(/no matches/i)).toBeInTheDocument());
  });
});

describe("FindPeople — verification gate", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    toastErrorMock.mockReset();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  async function searchFor(query: string) {
    fireEvent.change(screen.getByRole("searchbox", { name: /find people/i }), {
      target: { value: query },
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
  }

  /** Rows over the wire, not a module stub: the search route answers 200 with
   * a filtered list even to an unverified caller (NEU-1161 §4), and that is the
   * shape this suite should be reading. */
  function serveResults() {
    server.use(
      http.get(`${env.apiBaseUrl}/users/search`, () =>
        HttpResponse.json([{ id: "u-1", display_name: "Alice", handle: "alice" }]),
      ),
    );
  }

  it("explains the gate above the results and describes every Connect button with it", async () => {
    server.use(meHandler(null));
    serveResults();

    renderWithProviders(<FindPeople />);
    const notice = await screen.findByRole("note");
    expect(notice).toHaveTextContent(/verify your email to connect with people/i);
    expect(notice).toHaveTextContent(/let them find you/i);

    await searchFor("ali");
    const button = screen.getByRole("button", { name: /^connect$/i });
    // `aria-disabled`, never `disabled`: the button stays in the tab order so
    // the description travels with it.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby", notice.id);
  });

  it("issues no request when a gated Connect is pressed", async () => {
    server.use(meHandler(null));
    serveResults();
    let posts = 0;
    server.use(
      http.post(`${env.apiBaseUrl}/connection-requests`, () => {
        posts += 1;
        return new HttpResponse(null, { status: 201 });
      }),
    );

    renderWithProviders(<FindPeople />);
    await screen.findByRole("note");
    await searchFor("ali");
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringMatching(/verify your email first/i),
      ),
    );
    expect(posts).toBe(0);
  });

  it("renders the notice even when the banner has been dismissed for this tab", async () => {
    sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    server.use(meHandler(null));
    serveResults();

    renderWithProviders(<FindPeople />);
    expect(await screen.findByRole("note")).toBeInTheDocument();
  });

  it("shows no notice and an ordinary Connect button for a verified viewer", async () => {
    server.use(meHandler(VERIFIED_AT));
    serveResults();

    renderWithProviders(<FindPeople />);
    await searchFor("ali");
    await waitFor(() => expect(screen.queryByRole("note")).not.toBeInTheDocument());
    const button = screen.getByRole("button", { name: /^connect$/i });
    expect(button).not.toHaveAttribute("aria-disabled");
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("reads the backend's 403 email_not_verified rather than reporting a generic failure", async () => {
    // Verified at page load, refused at click time — the state the button gate
    // cannot see.
    server.use(meHandler(VERIFIED_AT));
    serveResults();
    server.use(
      http.post(`${env.apiBaseUrl}/connection-requests`, () =>
        HttpResponse.json({ detail: "email_not_verified" }, { status: 403 }),
      ),
    );

    renderWithProviders(<FindPeople />);
    await searchFor("ali");
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringMatching(/verify your email first/i),
      ),
    );
    expect(toastErrorMock).not.toHaveBeenCalledWith(expect.stringMatching(/try again/i));
  });

  it("renders no report control on a search result", async () => {
    vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([
      { id: "u-1", display_name: "Alice", handle: "alice" },
    ]);
    renderWithProviders(<FindPeople />);

    fireEvent.change(screen.getByRole("searchbox", { name: /find people/i }), {
      target: { value: "alice" },
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    // Deliberately absent (NEU-1168 §2): search is the surface people scan
    // fastest, and the reporter's daily budget would be spendable on strangers
    // they have never dealt with. The name links to /users/{id}, which carries
    // the control.
    expect(screen.queryByRole("button", { name: /^Report / })).not.toBeInTheDocument();
  });

  it("draws each result through UserIdentity", async () => {
    vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([
      { id: "u-1", display_name: "Alice", handle: "alice" },
    ]);
    renderWithProviders(<FindPeople />);
    fireEvent.change(screen.getByRole("searchbox", { name: /find people/i }), {
      target: { value: "ali" },
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    const identity = document.querySelector("[data-user-identity]");
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent("@alice");
  });

  it("names the handle in the placeholder", () => {
    renderWithProviders(<FindPeople />);
    expect(screen.getByRole("searchbox", { name: /find people/i })).toHaveAttribute(
      "placeholder",
      "Search by display name, handle or email",
    );
  });

  it("counts the minimum query length after a leading sigil", async () => {
    // `@t` is a one-character query: the server strips the sigil before it
    // matches (NEU-1163 §8), so the minimum has to mean the same thing on both
    // sides of the wire.
    const search = vi.spyOn(connectionsApi, "searchUsers").mockResolvedValue([]);
    renderWithProviders(<FindPeople />);
    const box = screen.getByRole("searchbox", { name: /find people/i });

    fireEvent.change(box, { target: { value: "@t" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(search).not.toHaveBeenCalled();

    fireEvent.change(box, { target: { value: "@to" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Sent as typed, sigil included — the strip is the server's.
    await waitFor(() => expect(search).toHaveBeenCalledWith("@to"));
  });
});
