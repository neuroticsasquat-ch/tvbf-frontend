import { CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useMarkShow, useUnmarkShow } from "@/api/me";
import { Button } from "@/components/ui/button";

interface Props {
  showId: number;
  watchedCount: number;
  airedCount: number;
}

export function ShowWatchCheckbox({ showId, watchedCount, airedCount }: Props) {
  const { user } = useAuth();
  const mark = useMarkShow();
  const unmark = useUnmarkShow();

  if (!user) return null;
  if (airedCount === 0) return null;

  const fullyWatched = watchedCount >= airedCount;

  function onClick() {
    if (fullyWatched) unmark.mutate(showId);
    else mark.mutate(showId);
  }

  return (
    <Button
      type="button"
      variant={fullyWatched ? "outline" : "default"}
      size="sm"
      onClick={onClick}
      aria-pressed={fullyWatched}
      title={fullyWatched ? "Show fully watched — click to unmark" : "Click to mark all aired episodes watched"}
      className={fullyWatched ? "text-emerald-700" : undefined}
    >
      {fullyWatched ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
      {fullyWatched ? "Show watched" : "Mark show watched"}
    </Button>
  );
}
