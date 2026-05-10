import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CollapsibleSummary } from "./CollapsibleSummary";

/** jsdom doesn't compute layout, so scrollHeight/clientHeight are always 0.
 * These helpers stub the prototype so we can simulate "fits" vs "overflows". */
function stubHeights({ scroll, client }: { scroll: number; client: number }) {
  const originals = {
    scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight"),
    clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight"),
  };
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => scroll,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => client,
  });
  return () => {
    if (originals.scrollHeight) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", originals.scrollHeight);
    }
    if (originals.clientHeight) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", originals.clientHeight);
    }
  };
}

describe("CollapsibleSummary", () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("renders nothing when html is null", () => {
    const { container } = render(<CollapsibleSummary html={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render the toggle when content fits within the clamp", () => {
    restore = stubHeights({ scroll: 80, client: 80 });
    render(<CollapsibleSummary html="<p>Short summary.</p>" />);

    expect(screen.getByText("Short summary.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /read more/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /read less/i })).not.toBeInTheDocument();
  });

  it("renders Read more when content overflows; clicking flips aria-expanded and label", () => {
    restore = stubHeights({ scroll: 320, client: 80 });
    render(<CollapsibleSummary html="<p>Long summary.</p>" />);

    const toggle = screen.getByRole("button", { name: /read more/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    const collapsed = screen.getByRole("button", { name: /read less/i });
    expect(collapsed).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(collapsed);
    expect(screen.getByRole("button", { name: /read more/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("clicking anywhere in the summary toggles expand/collapse", () => {
    restore = stubHeights({ scroll: 320, client: 80 });
    render(<CollapsibleSummary html="<p>Long summary body text.</p>" />);

    expect(screen.getByRole("button", { name: /read more/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    // Re-query the body each click — the closure can otherwise hold a stale
    // selection state between fireEvent calls.
    fireEvent.click(screen.getByText("Long summary body text."));
    expect(screen.getByRole("button", { name: /read less/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // Reset any selection state jsdom may have set during the prior click,
    // since the component skips toggling when a Range selection is active.
    window.getSelection()?.removeAllRanges();

    fireEvent.click(screen.getByText("Long summary body text."));
    expect(screen.getByRole("button", { name: /read more/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("clicking a link inside the summary does not toggle expand/collapse", () => {
    restore = stubHeights({ scroll: 320, client: 80 });
    render(
      <CollapsibleSummary html='<p>See <a href="https://example.com">this</a> for details.</p>' />,
    );

    const link = screen.getByRole("link", { name: /this/i });
    fireEvent.click(link);

    // Still collapsed — link click was not interpreted as a toggle.
    expect(screen.getByRole("button", { name: /read more/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("sanitizes HTML before rendering", () => {
    restore = stubHeights({ scroll: 80, client: 80 });
    const { container } = render(
      <CollapsibleSummary html="<p>OK</p><script>window.__pwn=1</script>" />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});
