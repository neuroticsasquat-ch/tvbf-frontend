import { CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useMarkSeason, useUnmarkSeason } from "@/api/me";
import { Button } from "@/components/ui/button";

interface Props {
  showId: number;
  season: number;
  aired: number;
  watched: number;
}

export function SeasonWatchCheckbox({ showId, season, aired, watched }: Props) {
  const { user } = useAuth();
  const mark = useMarkSeason();
  const unmark = useUnmarkSeason();

  if (!user) return null;

  const fullyWatched = aired > 0 && watched >= aired;
  const disabled = aired === 0;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (fullyWatched) unmark.mutate({ showId, season });
    else mark.mutate({ showId, season });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={fullyWatched}
      aria-label={fullyWatched ? "Mark season unwatched" : "Mark season watched"}
      title={
        fullyWatched ? "Season fully watched — click to unmark" : "Click to mark season watched"
      }
      className={
        fullyWatched
          ? "text-emerald-600 hover:text-emerald-700"
          : "text-muted-foreground hover:text-foreground"
      }
    >
      {fullyWatched ? <CheckCircle2 aria-hidden /> : <Circle aria-hidden />}
    </Button>
  );
}
