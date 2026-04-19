import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders current and total pages", () => {
    render(<Pagination page={3} totalPages={10} onPageChange={vi.fn()} />);
    expect(screen.getByText(/Page 3 of 10/i)).toBeInTheDocument();
  });

  it("disables prev on first page", () => {
    render(<Pagination page={1} totalPages={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("disables next on last page", () => {
    render(<Pagination page={10} totalPages={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("calls onPageChange with next page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={10} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
