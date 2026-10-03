import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandLockup } from "./BrandLockup";

/** The lockup is asserted **once, here** (NEU-1509 §3.5). The header and the
 * login hero render through this component, and each surface's own test asserts
 * only `[data-brand-lockup]` — the tripwire against a third surface hand-rolling
 * the icon-plus-text pairing this replaced. */
describe("BrandLockup", () => {
  function lockup(): HTMLElement {
    const root = document.querySelector("[data-brand-lockup]");
    if (!(root instanceof HTMLElement)) throw new Error("no BrandLockup rendered");
    return root;
  }

  function mark(): SVGSVGElement {
    const svg = lockup().querySelector("svg");
    if (!svg) throw new Error("no mark rendered");
    return svg;
  }

  it.each(["header", "hero"] as const)("draws the mark then the wordmark at %s size", (size) => {
    render(<BrandLockup size={size} />);
    expect(lockup().firstElementChild).toBe(mark());
    // Exactly the product name: the header link's `aria-label` and every
    // `getByText("TV BingeFriend")` keep agreeing with what is on screen.
    expect(lockup().textContent).toBe("TV BingeFriend");
    expect(screen.getByText("Binge")).toBeInTheDocument();
  });

  it("hides the mark from assistive tech and colours it brand amber", () => {
    render(<BrandLockup size="header" />);
    expect(mark()).toHaveAttribute("aria-hidden", "true");
    expect(mark().getAttribute("class")).toContain("text-brand");
  });

  it("sets the wordmark in the brand font with TV in brand amber", () => {
    render(<BrandLockup size="header" />);
    const wordmark = screen.getByText("TV").parentElement;
    expect(wordmark?.className).toContain("font-brand");
    expect(screen.getByText("TV").className).toContain("text-brand");
    expect(screen.getByText("Binge").className).not.toContain("text-brand");
  });

  it("draws the mark taller at hero size than at header size", () => {
    const heights = (["header", "hero"] as const).map((size) => {
      const { unmount } = render(<BrandLockup size={size} />);
      const height = (mark().getAttribute("class") ?? "").match(/\bh-\d+\b/)?.[0];
      unmount();
      return height;
    });
    expect(heights).toEqual(["h-7", "h-10"]);
  });
});
