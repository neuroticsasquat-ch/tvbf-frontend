import { Star } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

type Props = {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
};

function clampHalfStep(v: number): number {
  if (v < 0.5) return 0.5;
  if (v > 5) return 5;
  return Math.round(v * 2) / 2;
}

export function StarRatingInput({ value, onChange, disabled, size = "md" }: Props) {
  const iconClass = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  const filled = value ?? 0;

  function pick(next: number) {
    if (disabled) return;
    if (value !== null && Math.abs(value - next) < 1e-9) {
      onChange(null);
    } else {
      onChange(next);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const cur = value ?? 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(clampHalfStep(cur + 0.5));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = cur - 0.5;
      if (next < 0.5) onChange(null);
      else onChange(clampHalfStep(next));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(0.5);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(5);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onChange(null);
    }
  }

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value ?? 0}
      aria-disabled={disabled || undefined}
      aria-label="Your rating"
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex select-none items-center gap-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "opacity-50",
      )}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const halfVal = n - 0.5;
        const fullVal = n;
        const halfPct = Math.max(0, Math.min(1, filled - (n - 1))) * 100;
        return (
          <span key={n} className="relative inline-flex">
            <Star className={cn(iconClass, "text-muted-foreground/40 shrink-0")} aria-hidden />
            <span
              className="absolute inset-0 overflow-hidden text-amber-500"
              style={{ width: `${halfPct}%` }}
              aria-hidden
            >
              <Star className={cn(iconClass, "fill-current shrink-0")} aria-hidden />
            </span>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onClick={() => pick(halfVal)}
              aria-label={`${halfVal} stars`}
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer disabled:cursor-not-allowed"
            />
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onClick={() => pick(fullVal)}
              aria-label={`${fullVal} stars`}
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer disabled:cursor-not-allowed"
            />
          </span>
        );
      })}
    </div>
  );
}
