import { useAuth } from "./AuthContext";
import { useMarkSeason, useUnmarkSeason } from "@/api/me";

export function SeasonWatchToggle({ showId, season }: { showId: number; season: number }) {
  const { user } = useAuth();
  const mark = useMarkSeason();
  const unmark = useUnmarkSeason();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => mark.mutate({ showId, season })}
        className="text-xs underline"
      >
        Mark season watched
      </button>
      <button
        type="button"
        onClick={() => unmark.mutate({ showId, season })}
        className="text-xs underline"
      >
        Unmark season
      </button>
    </div>
  );
}
