import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TEST_ERROR_MESSAGE, throwTestError } from "@/lib/testError";
import { ErrorTestPage } from "./ErrorTestPage";

describe("ErrorTestPage", () => {
  it("offers a button that throws the test error", () => {
    render(<ErrorTestPage />);
    expect(screen.getByRole("button", { name: /throw test error/i })).toBeInTheDocument();
  });

  it("throws an error distinct enough to find in Bugsink", () => {
    expect(throwTestError).toThrow(TEST_ERROR_MESSAGE);
    expect(TEST_ERROR_MESSAGE).toContain("tvbf-frontend");
  });
});
