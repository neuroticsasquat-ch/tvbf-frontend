import type { ShowSummary } from "@/api/types";
import { ShowCard } from "./ShowCard";

export function ShowGrid({ shows }: { shows: ShowSummary[] }) {
  if (shows.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">No shows match your filters.</p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
      {shows.map((s) => (
        <ShowCard key={s.id} show={s} />
      ))}
    </div>
  );
}
