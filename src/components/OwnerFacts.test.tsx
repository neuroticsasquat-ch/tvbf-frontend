import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RatingOwner } from "@/lib/rating";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OwnerFacts } from "./OwnerFacts";

const YOU: RatingOwner = { kind: "own" };
const JEANNE: RatingOwner = { kind: "other", ownerName: "Jeanne" };

describe("OwnerFacts", () => {
  it("renders the self-mode markup with no name and no prefixes", () => {
    renderWithProviders(
      <OwnerFacts
        owner={YOU}
        layout="inline"
        status={null}
        progress={{ watched: 12, aired: 46 }}
        rating={null}
        lastWatchedAt="2026-08-01T00:00:00Z"
      />,
    );
    expect(screen.getByText("Progress: 12/46")).toBeInTheDocument();
    expect(screen.getByText(/^Last Watched:/)).toBeInTheDocument();
    expect(screen.queryByText(/'s progress/)).not.toBeInTheDocument();
  });

  it("names the owner once, visibly, and hides that name from assistive tech", () => {
    const { container } = renderWithProviders(
      <OwnerFacts
        owner={JEANNE}
        layout="inline"
        status={null}
        progress={{ watched: 38, aired: 46 }}
        rating={4}
        lastWatchedAt="2026-08-01T00:00:00Z"
      />,
    );
    const names = screen.getAllByText("Jeanne:");
    expect(names).toHaveLength(1);
    expect(names[0]).toHaveAttribute("aria-hidden");
    // The visible name is not what carries the attribution — each fact does.
    expect(container.querySelectorAll("[aria-hidden]").length).toBeGreaterThan(1);
  });

  it("attributes every fact in the accessibility tree, not by proximity", () => {
    renderWithProviders(
      <OwnerFacts
        owner={JEANNE}
        layout="inline"
        status={null}
        progress={{ watched: 38, aired: 46 }}
        rating={4}
        lastWatchedAt="2026-08-01T00:00:00Z"
      />,
    );
    expect(screen.getByText("Jeanne's progress: 38 of 46")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Jeanne's rating: 4.0 out of 5" })).toBeInTheDocument();
    expect(screen.getByText(/^Jeanne last watched /)).toBeInTheDocument();
  });

  it("attributes the status pill too, so a friend's caught-up state is theirs", () => {
    renderWithProviders(
      <OwnerFacts
        owner={JEANNE}
        layout="inline"
        status="finished"
        progress={null}
        rating={null}
        lastWatchedAt={null}
      />,
    );
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.getByText("Jeanne has finished this show")).toBeInTheDocument();
  });

  it("renders both layouts, differing in density rather than in facts", () => {
    const props = {
      owner: JEANNE,
      status: null,
      progress: { watched: 38, aired: 46 },
      rating: 4,
      lastWatchedAt: null,
    } as const;
    const inline = renderWithProviders(<OwnerFacts {...props} layout="inline" />);
    expect(screen.getByText("Jeanne's progress: 38 of 46")).toBeInTheDocument();
    inline.unmount();

    renderWithProviders(<OwnerFacts {...props} layout="stacked" />);
    expect(screen.getByText("Jeanne's progress: 38 of 46")).toBeInTheDocument();
    expect(screen.getByText("Jeanne:")).toBeInTheDocument();
  });

  it("renders nothing at all when the owner has no facts to report", () => {
    const { container } = renderWithProviders(
      <OwnerFacts
        owner={JEANNE}
        layout="inline"
        status={null}
        progress={null}
        rating={null}
        lastWatchedAt={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
