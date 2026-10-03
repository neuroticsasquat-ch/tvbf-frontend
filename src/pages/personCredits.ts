import type { EpisodeRef, SeasonOut, ShowRef } from "@/api/types";
import { episodeCountLabel } from "@/lib/episodeCount";
import { seasonLabel } from "@/lib/season";

/** One episode within a group, with every label that person holds on it. */
export interface EpisodeEntry {
  episode: EpisodeRef;
  /** Roles ("Story", "Teleplay") or character names, in the order returned. */
  labels: string[];
}

/** Collapse repeats of the same episode within a group, joining their labels.
 *
 * One person routinely holds two roles on one episode — Story and Teleplay is
 * routine — and can play two characters in one. Rendered as separate entries
 * those are two links with the same visible name pointing at the same episode,
 * which is what `CreditRow`'s `linkLabel` escape hatch existed to paper over.
 * Collapsing removes the collision instead of annotating it.
 *
 * Duplicate labels are dropped: the credit tables carry no unique constraint,
 * so upstream can repeat a credit verbatim.
 */
export function collapseByEpisode<T extends { episode: EpisodeRef }>(
  credits: readonly T[],
  label: (credit: T) => string,
): EpisodeEntry[] {
  const entries = new Map<number, EpisodeEntry>();
  for (const credit of credits) {
    const text = label(credit);
    const existing = entries.get(credit.episode.id);
    if (existing) {
      if (!existing.labels.includes(text)) existing.labels.push(text);
    } else {
      entries.set(credit.episode.id, { episode: credit.episode, labels: [text] });
    }
  }
  return [...entries.values()];
}

/** A character name, marked when the credit is a voice role. */
export function characterLabel(credit: { character: { name: string }; voice: boolean }): string {
  return credit.voice ? `${credit.character.name} (voice)` : credit.character.name;
}

/** Distinct labels across a group, order preserved — the detail line for a
 * show-level group ("Director · Writer"). */
export function distinctLabels<T>(credits: readonly T[], label: (credit: T) => string): string[] {
  const seen: string[] = [];
  for (const credit of credits) {
    const text = label(credit);
    if (!seen.includes(text)) seen.push(text);
  }
  return seen;
}

/** One show on the person page: everything one tab holds for the person on it
 * (NEU-1512 §5.4). The Cast tab builds it from regular credits and guest
 * credits, the Crew tab from series crew and episode crew — the API keeps the
 * grains apart, and this is where they meet, because the page labels neither. */
export interface ShowCreditCard {
  show: ShowRef;
  /** The count after the show's name; null when nothing supplies one. */
  episodeCount: number | null;
  /** Distinct character or role labels, show-level credits' first. */
  labels: string[];
  /** Seasons the person was a regular in, ascending. Empty on the Crew tab. */
  seasons: number[];
  /** One entry per episode credited, newest first as the API serves them. */
  episodes: EpisodeEntry[];
  /** The card's date: the latest of its regular credits' `last_credited` and
   * its episodes' air dates. Orders the cards. */
  latest: string | null;
}

interface CardSources<R, E> {
  /** Show-level credits — regular credits, or series crew. */
  showLevel: readonly R[];
  /** Episode-level credits — guest credits, or episode crew. */
  episodeLevel: readonly E[];
  label: (credit: R | E) => string;
  /** Regular seasons of a show-level credit; series crew has none. */
  seasonsOf?: (credit: R) => readonly number[];
  /** The latest air date a show-level credit covers; series crew has none. */
  lastCreditedOf?: (credit: R) => string | null;
}

function laterOf(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

/** Merge one tab's two lists into one card per show, newest credited first.
 *
 * **The count** is the sum of the show-level credits' `episode_count` — upstream
 * already counts a regular's guest turns into the aggregate, so adding the
 * guest episodes would count them twice. A show with no show-level credit
 * counts its episodes instead. A show whose show-level credits all lack a count
 * gets none rather than a guess.
 *
 * **The order** is the card's latest date, newest first, undated cards last,
 * show id breaking ties. ISO dates compare correctly as strings.
 */
export function buildShowCards<
  R extends { show: ShowRef; episode_count: number | null },
  E extends { show: ShowRef; episode: EpisodeRef },
>(sources: CardSources<R, E>): ShowCreditCard[] {
  const { showLevel, episodeLevel, label, seasonsOf, lastCreditedOf } = sources;
  const byShow = new Map<number, { show: ShowRef; showLevel: R[]; episodeLevel: E[] }>();
  const slot = (show: ShowRef) => {
    let entry = byShow.get(show.id);
    if (!entry) {
      entry = { show, showLevel: [], episodeLevel: [] };
      byShow.set(show.id, entry);
    }
    return entry;
  };
  for (const credit of showLevel) slot(credit.show).showLevel.push(credit);
  for (const credit of episodeLevel) slot(credit.show).episodeLevel.push(credit);

  const cards = [...byShow.values()].map(({ show, showLevel: own, episodeLevel: eps }) => {
    const episodes = collapseByEpisode(eps, label);
    const counts = own
      .map((credit) => credit.episode_count)
      .filter((n): n is number => n !== null);
    const episodeCount =
      own.length === 0
        ? episodes.length
        : counts.length > 0
          ? counts.reduce((a, b) => a + b, 0)
          : null;
    const seasons = [...new Set(own.flatMap((credit) => seasonsOf?.(credit) ?? []))].sort(
      (a, b) => a - b,
    );
    let latest: string | null = null;
    for (const credit of own) latest = laterOf(latest, lastCreditedOf?.(credit) ?? null);
    for (const entry of episodes) latest = laterOf(latest, entry.episode.airdate);
    return {
      show,
      episodeCount,
      labels: distinctLabels([...own, ...eps], label),
      seasons,
      episodes,
      latest,
    };
  });

  return cards.sort((a, b) => {
    if (a.latest !== b.latest) {
      if (a.latest === null) return 1;
      if (b.latest === null) return -1;
      return a.latest > b.latest ? -1 : 1;
    }
    return a.show.id - b.show.id;
  });
}

/** One regular season on a card: a link to that season's cast. */
export interface SeasonRow {
  number: number;
  /** "Season 3 · 22 episodes", or "Season 3" until the show's seasons load. */
  text: string;
  to: string;
}

/** The season rows of a card. The episode count comes from the show's own
 * season list, which the person page loads only when a card shows these rows —
 * the credits payload carries season numbers and nothing else about them. */
export function seasonRows(
  showId: number,
  seasons: readonly number[],
  showSeasons: readonly Pick<SeasonOut, "number" | "name" | "episode_order">[] | undefined,
): SeasonRow[] {
  return seasons.map((number) => {
    const season = showSeasons?.find((s) => s.number === number);
    return {
      number,
      text: [seasonLabel(season ?? { number }), episodeCountLabel(season?.episode_order)]
        .filter(Boolean)
        .join(" · "),
      to: `/shows/${showId}/episodes?season=${number}&tab=cast`,
    };
  });
}
