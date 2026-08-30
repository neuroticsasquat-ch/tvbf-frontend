import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { Route, Routes, useLocation } from "react-router";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { fixtureEpisodeCrew, fixtureEpisodes } from "@/test/msw/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EpisodePage } from "./EpisodePage";

const base = env.apiBaseUrl;

function LocationDisplay() {
  const { search } = useLocation();
  return <div data-testid="location-search">{search}</div>;
}

function PageWithLocation() {
  return (
    <>
      <EpisodePage />
      <LocationDisplay />
    </>
  );
}

function routed() {
  return (
    <Routes>
      <Route path="/episodes/:episodeId" element={<PageWithLocation />} />
    </Routes>
  );
}

beforeEach(() => {
  server.use(
    http.get(`${base}/episodes/5000`, () => HttpResponse.json(fixtureEpisodes[0])),
    http.get(`${base}/episodes/5001`, () => HttpResponse.json(fixtureEpisodes[1])),
  );
});

describe("EpisodePage", () => {
  it("renders episode details", async () => {
    renderWithProviders(routed(), { route: "/episodes/5000" });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Pilot/i })).toBeInTheDocument(),
    );
  });

  it("renders the credits region only when there is something to show", async () => {
    renderWithProviders(routed(), { route: "/episodes/5001" });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Second/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("opens on the Crew tab by default when crew is present", async () => {
    renderWithProviders(routed(), { route: "/episodes/5000" });

    expect(await screen.findByRole("tab", { name: /Crew \(3\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Guest cast \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Crew/ })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Di Director")).toBeInTheDocument();
  });

  it("opens on Guest cast when crew is empty but guest cast is present", async () => {
    server.use(http.get(`${base}/episodes/5000/crew`, () => HttpResponse.json([])));
    renderWithProviders(routed(), { route: "/episodes/5000" });

    expect(await screen.findByRole("tab", { name: /Guest cast \(2\)/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Crew \(0\)/ })).toBeDisabled();
  });

  it("enables both tabs when both credit lists have data", async () => {
    renderWithProviders(routed(), { route: "/episodes/5000" });

    expect(await screen.findByRole("tab", { name: /Crew \(3\)/ })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /Guest cast \(2\)/ })).toBeEnabled();
  });

  it("disables the empty tab while the other stays enabled", async () => {
    server.use(http.get(`${base}/episodes/5000/guest-cast`, () => HttpResponse.json([])));
    renderWithProviders(routed(), { route: "/episodes/5000" });

    expect(await screen.findByRole("tab", { name: /Crew \(3\)/ })).toBeEnabled();
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Guest cast \(0\)/ })).toBeDisabled(),
    );
  });

  it("keeps an errored tab enabled and renders its ErrorState", async () => {
    server.use(
      http.get(`${base}/episodes/5000/crew`, () =>
        HttpResponse.json({ detail: "server error" }, { status: 500 }),
      ),
    );
    renderWithProviders(routed(), { route: "/episodes/5000" });

    expect(await screen.findByRole("tab", { name: /Crew/ })).toBeEnabled();
    expect(await screen.findByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("deep-links to the guest cast panel via ?tab=guest-cast", async () => {
    renderWithProviders(routed(), { route: "/episodes/5000?tab=guest-cast" });

    expect(await screen.findByText("Gus Guest")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Guest cast/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to Crew for an unknown tab value", async () => {
    renderWithProviders(routed(), { route: "/episodes/5000?tab=nonsense" });

    expect(await screen.findByRole("tab", { name: /Crew/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to the other tab when the requested tab is empty", async () => {
    server.use(http.get(`${base}/episodes/5000/crew`, () => HttpResponse.json([])));
    renderWithProviders(routed(), { route: "/episodes/5000?tab=crew" });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Guest cast \(2\)/ })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("updates the URL with replace when switching tabs", async () => {
    const user = userEvent.setup();
    renderWithProviders(routed(), { route: "/episodes/5000" });

    await user.click(await screen.findByRole("tab", { name: /Guest cast/ }));
    await waitFor(() =>
      expect(screen.getByTestId("location-search").textContent).toBe("?tab=guest-cast"),
    );

    await user.click(screen.getByRole("tab", { name: /Crew/ }));
    await waitFor(() => expect(screen.getByTestId("location-search").textContent).toBe(""));
  });

  it("hides the in-panel headings while keeping them in the DOM", async () => {
    const user = userEvent.setup();
    renderWithProviders(routed(), { route: "/episodes/5000" });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Crew/, level: 2 })).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: /Crew/, level: 2 })).toHaveClass("sr-only");

    await user.click(screen.getByRole("tab", { name: /Guest cast/ }));
    expect(await screen.findByRole("heading", { name: /Guest cast/, level: 2 })).toHaveClass(
      "sr-only",
    );
  });

  it("resets the tab to Crew when navigating to another episode", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${base}/episodes/5001/crew`, () => HttpResponse.json(fixtureEpisodeCrew)),
    );
    renderWithProviders(routed(), { route: "/episodes/5000?tab=guest-cast" });

    await user.click(await screen.findByRole("button", { name: /Next episode/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Second/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("tab", { name: /Crew/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("location-search").textContent).toBe("");
  });
});
