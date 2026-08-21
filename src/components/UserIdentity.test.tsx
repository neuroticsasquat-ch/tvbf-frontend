import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserIdentity } from "./UserIdentity";

/** The pairing is asserted **once, here** (NEU-1169 §7, AC 9). Every surface
 * renders through this component, so the layout is inherited rather than
 * restated per row — which is the property that stops seven hand-rolled spans
 * drifting apart. Each surface's own test asserts only that it goes through
 * here, via `[data-user-identity]`. */
describe("UserIdentity", () => {
  function identity(): HTMLElement {
    const root = document.querySelector("[data-user-identity]");
    if (!(root instanceof HTMLElement)) throw new Error("no UserIdentity rendered");
    return root;
  }

  it("renders the display name over the handle, stacked", () => {
    render(<UserIdentity displayName="Tom Boone" handle="tom_boone" />);
    const root = identity();
    expect(root.className).toContain("flex-col");
    // Name first, handle second — the identifier reads as a subtitle of the
    // label, not the other way round.
    expect(root.textContent).toBe("Tom Boone@tom_boone");
  });

  it("prints the handle with its sigil, which is not part of the stored value", () => {
    render(<UserIdentity displayName="Tom Boone" handle="tom_boone" />);
    expect(screen.getByText("@tom_boone")).toBeInTheDocument();
    expect(screen.queryByText("tom_boone")).not.toBeInTheDocument();
  });

  it("truncates both lines", () => {
    // A 30-character handle is contract-legal (NEU-1163 §1), and a row is
    // ~250px wide: neither line may push the row's action button off it.
    render(<UserIdentity displayName={"A very long display name"} handle={"h".repeat(30)} />);
    const root = identity();
    expect(root.className).toContain("min-w-0");
    for (const line of Array.from(root.children)) {
      expect(line.className).toContain("truncate");
    }
  });

  it("scales the type at the heading variant without changing the layout", () => {
    render(<UserIdentity displayName="Tom Boone" handle="tom_boone" size="heading" />);
    const root = identity();
    const [name, handle] = Array.from(root.children);
    expect(name.className).toContain("text-2xl");
    expect(handle.className).toContain("text-sm");
    // Still stacked: `size` is a type scale, not a layout switch.
    expect(root.className).toContain("flex-col");
  });

  it("defaults to the row variant", () => {
    render(<UserIdentity displayName="Tom Boone" handle="tom_boone" />);
    const [name, handle] = Array.from(identity().children);
    expect(name.className).toContain("text-sm");
    expect(handle.className).toContain("text-xs");
  });
});
