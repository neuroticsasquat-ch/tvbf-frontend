import { useSearchParams } from "react-router";

import { SearchOverlay } from "@/components/SearchOverlay";

export function SearchPage() {
  const [params] = useSearchParams();
  const search = (params.get("search") ?? "").trim();

  if (!search) {
    return (
      <p className="text-sm text-muted-foreground">
        Type a show name in the search box above.
      </p>
    );
  }
  return <SearchOverlay search={search} />;
}
