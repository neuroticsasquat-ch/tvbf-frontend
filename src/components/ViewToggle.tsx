import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/cn";

export type ViewMode = "list" | "grid";

export function ViewToggle({
  value,
  onChange,
  ariaLabel = "Display",
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
  ariaLabel?: string;
}) {
  const btnCls = (active: boolean) =>
    cn(
      "inline-flex items-center justify-center h-8 w-8 border border-border",
      active
        ? "bg-accent text-foreground"
        : "bg-background text-muted-foreground hover:text-foreground",
    );
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded overflow-hidden">
      <button
        type="button"
        aria-pressed={value === "list"}
        aria-label="List view"
        onClick={() => onChange("list")}
        className={cn(btnCls(value === "list"), "rounded-l")}
      >
        <List className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={value === "grid"}
        aria-label="Grid view"
        onClick={() => onChange("grid")}
        className={cn(btnCls(value === "grid"), "rounded-r -ml-px")}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
