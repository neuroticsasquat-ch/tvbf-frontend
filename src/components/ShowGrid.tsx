import type { ShowSummary } from "@/api/types";
import { ShowCard } from "./ShowCard";

export function ShowGrid({ shows }: { shows: ShowSummary[] }) {
  if (shows.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">No shows match your filters.</p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {shows.map((s) => (
        <ShowCard key={s.id} show={s} />
      ))}
    </div>
  );
}
