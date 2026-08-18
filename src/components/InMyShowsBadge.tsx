import { Library } from "lucide-react";
import { cn } from "@/lib/cn";

/** The one "in My Shows" mark, on every surface that shows one.
 *
 * There were three of these and two of them disagreed. The card grids and the
 * friend list-view rows drew a white ✓ in an emerald circle; TMDB Discovery's
 * `ShowCard` drew the library icon on a neutral chip (NEU-1057). Same claim,
 * two pictures, and the green ✓ additionally collided with the meaning it
 * carries everywhere else in the app — `EpisodeWatchCheckbox`,
 * `SeasonWatchCheckbox` and `ShowWatchCheckbox` all use emerald for *watched*,
 * which is a different fact about a show from *tracked*.
 *
 * The library icon wins on both counts: it says "in your library" rather than
 * "done", and it matches `MyShowsToggle` — the control that puts a show here in
 * the first place. One component rather than a shared class string, because a
 * string is what drifted.
 *
 * **The label says "In your My Shows", unconditionally.** The claim never
 * varies by surface — `CallerPosterBadge` gates on the *caller* having the
 * show, `ShowCard` takes the *viewer's* `inMyShows`, and a card on your own
 * library is tautologically yours — so the mark needs no context prop and no
 * per-surface wording (NEU-1181 §6.5). What varies is only legibility: the
 * feature is named "**My** Shows", and on a friend's page "my" reads as
 * ambiguous beside facts that are theirs. It keeps the feature name rather than
 * reading "In your library", so the mark stays visibly tied to the control that
 * creates it.
 *
 * **Positioning is not the caller's — the mark is always top-left.** It used to
 * be: the cards put their rating badge in different corners, so the mark went
 * wherever that card had room, and moving between Discover and My Shows the two
 * marks traded places diagonally. `ShowPoster` assigns the corner now, under
 * one rule — facts on top, controls on the bottom, library mark top-left,
 * viewer's rating top-right (NEU-1183 §3.4). The `className` prop remains for
 * the offset itself, and every caller should be `ShowPoster`.
 */
export function InMyShowsBadge({ className }: { className?: string }) {
  return (
    <span
      role="img"
      title="In your My Shows"
      aria-label="In your My Shows"
      className={cn(
        "absolute inline-flex items-center rounded-sm bg-foreground/85 p-1 text-background shadow",
        className,
      )}
    >
      <Library className="h-3 w-3" aria-hidden />
    </span>
  );
}
