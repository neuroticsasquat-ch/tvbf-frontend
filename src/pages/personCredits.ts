import type { EpisodeRef, ShowRef } from "@/api/types";

/** All of one person's credits of a single kind on a single show — a *credit
 * group* in the glossary. Presentation only: the API returns credits
 * individually and grouping happens here. */
export interface CreditGroup<T> {
  show: ShowRef;
  credits: T[];
}

/** Group credits by show, preserving the order each show first appears in.
 *
 * First-appearance order is doing real work: the API already returns cast and
 * crew ordered by `show.premiered DESC`, and guest and episode-crew ordered by
 * `episode.airdate DESC`. So a show's first credit is its most significant one
 * under whichever rule applies, and inheriting that order gives groups ordered
 * by newest episode (episode-level) or newest show (show-level) without
 * sorting anything or reading a date.
 *
 * That means this must stay stable. Sorting here would silently substitute a
 * different ordering rule for the one the backend chose deliberately.
 */
export function groupByShow<T extends { show: ShowRef }>(credits: readonly T[]): CreditGroup<T>[] {
  const groups = new Map<number, CreditGroup<T>>();
  for (const credit of credits) {
    const existing = groups.get(credit.show.id);
    if (existing) {
      existing.credits.push(credit);
    } else {
      groups.set(credit.show.id, { show: credit.show, credits: [credit] });
    }
  }
  return [...groups.values()];
}

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
