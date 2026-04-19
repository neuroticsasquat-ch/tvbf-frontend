import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_SORT_KEYS, type ShowFilters, type SortKey } from "@/api/types";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name (A–Z)",
  "-name": "Name (Z–A)",
  premiered: "Premiere date (oldest)",
  "-premiered": "Premiere date (newest)",
  tvmaze_updated: "Recently updated (oldest)",
  "-tvmaze_updated": "Recently updated",
};

const STATUSES = ["Running", "Ended", "To Be Determined", "In Development"] as const;

interface FiltersProps {
  filters: ShowFilters;
  onChange: (next: Partial<ShowFilters>) => void;
}

export function Filters({ filters, onChange }: FiltersProps) {
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");

  useEffect(() => {
    setSearchDraft(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft !== (filters.search ?? "")) {
        onChange({ search: searchDraft || undefined });
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchDraft, filters.search, onChange]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Show name"
        />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={filters.status ?? "__all"}
          onValueChange={(v) => onChange({ status: v === "__all" ? undefined : v })}
        >
          <SelectTrigger id="status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Any status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="sort">Sort</Label>
        <Select
          value={filters.sort ?? "name"}
          onValueChange={(v) => onChange({ sort: v as SortKey })}
        >
          <SelectTrigger id="sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_SORT_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
