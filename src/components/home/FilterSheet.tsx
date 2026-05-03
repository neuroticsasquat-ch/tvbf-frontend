import { useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { key: T; label: string };

export function FilterSheet<T extends string>({
  title,
  triggerLabel,
  triggerIcon,
  ariaLabel,
  options,
  value,
  onChange,
  active = false,
}: {
  title: string;
  triggerLabel: string;
  triggerIcon?: ReactNode;
  ariaLabel: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (next: T) => void;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "text-sm rounded px-2 py-1 inline-flex items-center gap-1 hover:bg-accent",
          active
            ? "border border-foreground bg-accent font-medium text-foreground"
            : "border border-border bg-background",
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
              const active = opt.key === value;
              return (
                <li key={opt.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.key);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 text-left rounded px-3 py-3 text-sm hover:bg-accent",
                      active && "font-semibold",
                    )}
                  >
                    <span className="w-4 inline-flex justify-center">
                      {active && <Check className="h-4 w-4" aria-hidden />}
                    </span>
                    <span>{opt.label}</span>
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
