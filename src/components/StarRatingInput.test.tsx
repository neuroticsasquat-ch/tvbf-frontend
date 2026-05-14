import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StarRatingInput } from "./StarRatingInput";

function clearSelection() {
  window.getSelection()?.removeAllRanges();
}

describe("StarRatingInput", () => {
  it("calls onChange with 1.5 when clicking left half of star 2", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={null} onChange={onChange} />);
    const buttons = screen.getAllByRole("button");
    // 10 half-buttons total. Star 2 left half = index 2.
    clearSelection();
    fireEvent.click(buttons[2]);
    expect(onChange).toHaveBeenCalledWith(1.5);
  });

  it("calls onChange with 2 when clicking right half of star 2", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={null} onChange={onChange} />);
    const buttons = screen.getAllByRole("button");
    clearSelection();
    fireEvent.click(buttons[3]);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("clicking the current value clears (passes null)", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={3} onChange={onChange} />);
    // Right half of star 3 = index 5
    const buttons = screen.getAllByRole("button");
    clearSelection();
    fireEvent.click(buttons[5]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("ArrowRight from 3 → 3.5", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={3} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(3.5);
  });

  it("ArrowLeft from 3 → 2.5", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={3} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it("Home → 0.5", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={3} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("End → 5", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={3} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "End" });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("Backspace → null", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={3} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("disabled prevents clicks and key events", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={3} onChange={onChange} disabled />);
    const buttons = screen.getAllByRole("button");
    clearSelection();
    fireEvent.click(buttons[5]);
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "Backspace" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowLeft from 0.5 clears", () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={0.5} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("sets aria-valuenow from value", () => {
    render(<StarRatingInput value={3.5} onChange={() => {}} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "3.5");
  });
});
