import { useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type Option<T extends string> = {
  key: T;
  label: string;
  /** When set, the option is rendered greyed out and unclickable. The value is
   * shown as a tooltip via `title=` so users can read why. */
  disabledReason?: string;
};

export function FilterSheet<T extends string>({
  title,
  triggerLabel,
  triggerIcon,
  ariaLabel,
  options,
  value,
  onChange,
  active = false,
  triggerClassName,
  triggerAlign = "center",
}: {
  title: string;
  triggerLabel: ReactNode;
  triggerIcon?: ReactNode;
  ariaLabel: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (next: T) => void;
  active?: boolean;
  triggerClassName?: string;
  triggerAlign?: "center" | "start";
}) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "rounded px-2 py-1 inline-flex gap-1 text-left hover:bg-accent",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          triggerAlign === "start" ? "items-start" : "items-center",
          !triggerClassName && "text-sm",
          active
            ? "border border-foreground bg-accent font-medium text-foreground"
            : "border border-border bg-background",
          triggerClassName,
        )}
      >
        {triggerIcon}
        <span>{triggerLabel}</span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200 data-[state=closed]:duration-150"
        >
          <DialogPrimitive.Title className="text-base font-semibold mb-3 shrink-0">
            {title}
          </DialogPrimitive.Title>
          <ul className="flex flex-col flex-1 overflow-y-auto">
            {options.map((opt) => {
              const isActive = opt.key === value;
              const disabled = !!opt.disabledReason;
              return (
                <li key={opt.key}>
                  <button
                    type="button"
                    disabled={disabled}
                    title={opt.disabledReason}
                    onClick={() => {
                      if (disabled) return;
                      onChange(opt.key);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 text-left rounded px-3 py-3 text-sm",
                      disabled ? "text-muted-foreground/60 cursor-not-allowed" : "hover:bg-accent",
                      isActive && "font-semibold",
                    )}
                  >
                    <span className="w-4 inline-flex justify-center">
                      {isActive && <Check className="h-4 w-4" aria-hidden />}
                    </span>
                    <span>{opt.label}</span>
                    {disabled && (
                      <span className="ml-auto text-xs text-muted-foreground/60">n/a</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
