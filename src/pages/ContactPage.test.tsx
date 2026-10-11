import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactPage } from "./ContactPage";

describe("ContactPage", () => {
  it("offers the support@ address alongside the form (NEU-1568)", () => {
    render(<ContactPage />);
    const link = screen.getByRole("link", { name: "support@tvbingefriend.com" });
    expect(link).toHaveAttribute("href", "mailto:support@tvbingefriend.com");
  });
});
