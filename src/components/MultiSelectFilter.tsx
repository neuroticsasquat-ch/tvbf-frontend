import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export interface MultiSelectOption<V extends string | number> {
  value: V;
  label: string;
}

interface MultiSelectFilterProps<V extends string | number> {
  id?: string;
  label: string;
  placeholder?: string;
  options: MultiSelectOption<V>[];
  selected: V[];
  onChange: (next: V[]) => void;
  disabled?: boolean;
}

export function MultiSelectFilter<V extends string | number>({
  id,
  label,
  placeholder = "Any",
  options,
  selected,
  onChange,
  disabled,
}: MultiSelectFilterProps<V>) {
  const [open, setOpen] = useState(false);

  function toggle(value: V) {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  }

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter((l): l is string => l !== undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-9 w-full justify-between font-normal",
            selected.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="flex flex-wrap gap-1 text-left">
            {selected.length === 0 ? (
              placeholder
            ) : selectedLabels.length <= 2 ? (
              selectedLabels.map((l) => (
                <Badge key={l} variant="secondary" className="font-normal">
                  {l}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary" className="font-normal">
                {selected.length} selected
              </Badge>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const isSelected = selected.includes(o.value);
                return (
                  <CommandItem
                    key={String(o.value)}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    {o.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 ? (
            <div className="border-t border-border p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => onChange([])}
              >
                <X className="mr-2 h-3 w-3" />
                Clear selection
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
