import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeHtml } from "./SafeHtml";

describe("SafeHtml", () => {
  it("renders safe HTML", () => {
    const { container } = render(<SafeHtml html="<p>hi <b>there</b></p>" />);
    expect(container.querySelector("b")?.textContent).toBe("there");
  });

  it("strips script tags", () => {
    const { container } = render(<SafeHtml html='<p>ok</p><script>alert(1)</script>' />);
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders nothing for null", () => {
    const { container } = render(<SafeHtml html={null} />);
    expect(container.firstChild).toBeNull();
  });
});
