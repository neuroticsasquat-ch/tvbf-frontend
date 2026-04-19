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
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { useGenres, useNetworks } from "@/api/refs";
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
  const genresQuery = useGenres();
  const networksQuery = useNetworks();

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

  const genreOptions = (genresQuery.data ?? []).map((g) => ({ value: g.name, label: g.name }));
  const networkOptions = (networksQuery.data ?? [])
    .map((n) => ({
      value: n.id,
      label: n.country_code ? `${n.name} (${n.country_code})` : n.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-3">
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="genre">Genres</Label>
          <MultiSelectFilter
            id="genre"
            label="Genres"
            placeholder="Any genre"
            options={genreOptions}
            selected={filters.genre ?? []}
            onChange={(next) => onChange({ genre: next.length > 0 ? next : undefined })}
            disabled={genresQuery.isPending}
          />
        </div>
        <div>
          <Label htmlFor="network">Networks</Label>
          <MultiSelectFilter
            id="network"
            label="Networks"
            placeholder="Any network"
            options={networkOptions}
            selected={filters.network ?? []}
            onChange={(next) => onChange({ network: next.length > 0 ? next : undefined })}
            disabled={networksQuery.isPending}
          />
        </div>
      </div>
    </div>
  );
}
