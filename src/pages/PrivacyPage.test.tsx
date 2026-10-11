import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PrivacyPage } from "./PrivacyPage";

describe("PrivacyPage", () => {
  it("names the privacy@ address in its Contact section (NEU-1568)", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "privacy@tvbingefriend.com" });
    expect(link).toHaveAttribute("href", "mailto:privacy@tvbingefriend.com");
  });
});
