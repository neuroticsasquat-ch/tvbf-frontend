import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router";
import { usePerson, usePersonCredits } from "@/api/people";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { cn } from "@/lib/cn";
import { NotFoundPage } from "./NotFoundPage";
import type { EpisodeRef, PersonOut, ShowRef } from "@/api/types";
import {
  characterLabel,
  collapseByEpisode,
  distinctLabels,
  groupByShow,
  type EpisodeEntry,
} from "./personCredits";

/** Entries shown per section before the "Show all" affordance. Sections are
 * wildly uneven — Zachary Levi is 11 cast / 0 crew / 61 guest — and the guest
 * section is usually the largest, so every section collapses by the same rule
 * rather than the page guessing which one will be long. */
const COLLAPSED_COUNT = 12;

/** Episodes listed inside one expanded credit group before it stops and just
 * states the remainder.
 *
 * Groups are genuinely unbounded: Debbie Griffin holds 8,010 episode-crew
 * credits on Jeopardy! alone, and a game show or soap will do that to anyone
 * who worked on it for years. Rendering all of them puts thousands of rows
 * inside one grid cell.
 *
 * There is deliberately no second "show the rest" — a filmography entry is
 * there to say what someone did on a show, and the thousandth Jeopardy! episode
 * does not add to that. Anyone who wants the full list wants the show's episode
 * page, which the card's title already links to. */
const EPISODES_PER_GROUP = 10;

const FALLBACK_HEADSHOT =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><rect width='1' height='1' fill='%23e2e8f0'/></svg>";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Built from parts into a local Date, matching the airdate formatters
 * elsewhere: `new Date("1972-09-09")` is UTC midnight, which formats a day
 * early in any negative-offset zone. */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return DATE_FMT.format(new Date(y, m - 1, d));
}

/** "September 9, 1972 – March 4, 2020", or one date labelled, or nothing. */
function personDates(person: PersonOut): string | null {
  const born = formatDate(person.birthday);
  const died = formatDate(person.deathday);
  if (born && died) return `${born} – ${died}`;
  if (born) return `Born ${born}`;
  if (died) return `Died ${died}`;
  return null;
}

/** "S2E11", or just "S2" for a special, which upstream leaves unnumbered. */
function episodeCode(episode: EpisodeRef): string {
  return episode.number === null ? `S${episode.season}` : `S${episode.season}E${episode.number}`;
}

function showYear(premiered: string | null): string | null {
  return premiered ? premiered.slice(0, 4) : null;
}

/** One credit: a link into the catalog plus a secondary line. All four credit
 * kinds share this shape — only what the link points at differs. */
function CreditRow({
  to,
  title,
  detail,
}: {
  to: string;
  title: string;
  detail?: string | null;
}) {
  // No `linkLabel` override any more. It existed because an episode-crew credit
  // repeated the same episode once per role, giving a screen reader two
  // identically-named links to one href. Collapsing repeats per episode
  // (`collapseByEpisode`) removes the collision at source, so every link's
  // visible name is already unique within its section.
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-tight">
        <Link
          to={to}
          className="rounded underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {title}
        </Link>
      </p>
      {detail ? (
        <p className="truncate text-xs text-muted-foreground leading-tight">{detail}</p>
      ) : null}
    </div>
  );
}

interface CreditSectionProps<T> {
  id: string;
  title: string;
  /** Grid items — credit groups, not individual credits. */
  items: T[];
  /** Credits behind those groups. The heading counts credits, not groups: the
   * number states the size of someone's filmography, and "(3)" for a director
   * with 40 episodes across three shows would understate their work. */
  creditCount: number;
  keyOf: (item: T) => React.Key;
  renderItem: (item: T) => ReactNode;
}

function CreditSection<T>({
  id,
  title,
  items,
  creditCount,
  keyOf,
  renderItem,
}: CreditSectionProps<T>) {
  const [expanded, setExpanded] = useState(false);

  // Sections hide entirely when empty. 0 / 1 / 0 is a common shape in the
  // mirror, and an empty header reads as a broken section, not an absent one.
  if (items.length === 0) return null;

  // The threshold counts cards, since cards are what the grid lays out.
  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="mb-3 text-lg font-semibold">
        {title} <span className="font-normal text-muted-foreground">({creditCount})</span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          // Keyed by identity, not index: grouping reorders and splices, so the
          // old "rendered as-is" justification for an index key no longer holds.
          <li key={keyOf(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {items.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 rounded text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Named: the heading counts credits and this counts cards, so a bare
              "Show all 13" under "Episode crew (40)" reads as a contradiction. */}
          {expanded ? "Show less" : `Show all ${items.length} shows`}
        </button>
      )}
    </section>
  );
}

/** A show whose episode-level credits collapse behind a disclosure.
 *
 * Only guest and episode-crew credits use this. Cast and crew cards already
 * link to the show, so merging them loses nothing and needs no disclosure —
 * these link to individual episodes, and the expander is what keeps every one
 * of those destinations reachable.
 */
function EpisodeGroupCard({
  show,
  summary,
  entries,
}: {
  show: ShowRef;
  summary: string;
  entries: EpisodeEntry[];
}) {
  const [open, setOpen] = useState(false);
  const listed = entries.slice(0, EPISODES_PER_GROUP);
  const remaining = entries.length - listed.length;

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-tight">
        <Link
          to={`/shows/${show.id}`}
          className="rounded underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show.name}
        </Link>
      </p>
      {/* Two things this button needs that are easy to miss.

          The chevron is the only thing marking it as interactive. The repo's
          other disclosures ("Read more", "Show all 12") carry that in the verb,
          but this one's text is a summary, and a noun phrase reads as a label —
          in a truncated grid cell there is no room for verb text without
          crowding out what the summary actually says.

          mt-1.5 and py-0.5 keep it clear of the show link directly above. Both
          are full-width-ish targets stacked with no gap otherwise, so aiming
          for one and hitting the other was easy.

          The aria-label adds the show, which is the card's visible heading but
          sits in a sibling element and so is not part of this control's
          accessible name. Without it, a director of three episodes each of two
          shows gets two buttons both announced "Director · 3 episodes". The
          visible text stays a prefix of the accessible name, so WCAG 2.5.3
          still holds. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${show.name} — ${summary}`}
        className="group mt-1.5 flex w-full min-w-0 items-center gap-0.5 rounded py-0.5 text-left text-xs text-muted-foreground leading-tight hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          aria-hidden
          className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")}
        />
        <span className="truncate underline-offset-2 group-hover:underline">{summary}</span>
      </button>
      {/* Rows are full-width click targets, so they need to be tall enough and
          separated enough not to be hit by accident. text-xs at leading-tight
          is ~15px, under WCAG 2.5.8's 24×24 minimum and with adjacent targets
          touching — py-1.5 takes each row to ~27px, space-y-1 puts a gap
          between them, and the hover background shows which one is armed. */}
      {open && (
        <ul className="mt-1 space-y-1 border-l border-border pl-2">
          {listed.map((entry) => {
            const detail = [entry.episode.name, entry.labels.join(" · ")]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={entry.episode.id}>
                {/* The whole row is the link, not just the episode code. The
                    episode name and role are the parts most likely to be aimed
                    at, and having them sit outside the anchor made the biggest
                    target on the row inert.

                    `block` matters: an inline anchor only covers its text, so
                    the row would still have dead space to the right of short
                    titles.

                    aria-label prefixes the show because two expanded cards can
                    otherwise expose rows reading the same — the visible text is
                    included verbatim, so WCAG 2.5.3 holds. */}
                <Link
                  to={`/episodes/${entry.episode.id}`}
                  aria-label={`${show.name} — ${[episodeCode(entry.episode), detail]
                    .filter(Boolean)
                    .join(" ")}`}
                  className="block truncate rounded px-1 py-1.5 text-xs leading-tight underline-offset-2 hover:bg-muted hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {episodeCode(entry.episode)}
                  {detail ? <span className="text-muted-foreground"> {detail}</span> : null}
                </Link>
              </li>
            );
          })}
          {remaining > 0 && (
            // Plain text, not a control. Expanding further would put thousands
            // of rows in a grid cell to no benefit; the card title links to the
            // show for anyone who wants the whole list.
            <li className="px-1 py-1.5 text-xs text-muted-foreground leading-tight">
              +{remaining.toLocaleString()} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** One show's episode-level credits, as a single filmography entry.
 *
 * Guest appearances and episode crew differ only in what labels a credit —
 * a character or a role — so they share this. Keeping them together is what
 * stops the two sections drifting apart in how they collapse, summarise and
 * name things, which is exactly where the accessibility bugs were.
 */
function EpisodeCreditCard<T extends { episode: EpisodeRef }>({
  show,
  credits,
  label,
}: {
  show: ShowRef;
  credits: T[];
  label: (credit: T) => string;
}) {
  const entries = collapseByEpisode(credits, label);

  // One episode on this show: render exactly as before, linking straight to it.
  // The common case must not gain an expander or a "1 episode".
  if (entries.length === 1) {
    const [entry] = entries;
    return (
      <CreditRow
        to={`/episodes/${entry.episode.id}`}
        title={`${show.name} — ${episodeCode(entry.episode)}`}
        detail={[entry.episode.name, entry.labels.join(" · ")].filter(Boolean).join(" · ")}
      />
    );
  }

  const summary = [
    distinctLabels(credits, label).join(" · "),
    `${entries.length} episodes`,
  ]
    .filter(Boolean)
    .join(" · ");

  return <EpisodeGroupCard show={show} summary={summary} entries={entries} />;
}

function Credits({ personId }: { personId: number }) {
  const { data, isPending, isError, error, refetch } = usePersonCredits(personId);

  if (isPending) return <LoadingState rows={1} />;
  // A failed request must not look like the (very common) no-credits case.
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  // Every category counts. Episode crew is reachable by no other route
  // upstream, so a director or writer with no cast, crew or guest credits is a
  // real and reachable shape — omitting it here would tell them "No credits
  // yet." while the section below rendered their credits.
  const total =
    data.cast.length + data.crew.length + data.guest_cast.length + data.episode_crew.length;
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No credits yet.</p>;
  }

  const castGroups = groupByShow(data.cast);
  const crewGroups = groupByShow(data.crew);
  const guestGroups = groupByShow(data.guest_cast);
  const episodeCrewGroups = groupByShow(data.episode_crew);

  return (
    <div className="space-y-8">
      {/* The API orders each list deliberately — cast and crew by show premiere
          descending, guest and episode-crew by air date descending with undated
          episodes last. `groupByShow` is stable, so groups inherit that order:
          a show's first credit is its most significant under whichever rule
          applies. Never re-sort here. */}
      <CreditSection
        id="cast"
        title="Cast"
        items={castGroups}
        creditCount={data.cast.length}
        keyOf={(group) => group.show.id}
        renderItem={(group) => (
          // Cast cards already pointed at the show, so merging duplicates for
          // one show loses no destination — the characters just join up.
          <CreditRow
            to={`/shows/${group.show.id}`}
            title={group.show.name}
            detail={[
              distinctLabels(group.credits, characterLabel).join(" · "),
              showYear(group.show.premiered),
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
      />
      <CreditSection
        id="crew"
        title="Crew"
        items={crewGroups}
        creditCount={data.crew.length}
        keyOf={(group) => group.show.id}
        renderItem={(group) => (
          <CreditRow
            to={`/shows/${group.show.id}`}
            title={group.show.name}
            detail={[
              distinctLabels(group.credits, (credit) => credit.role).join(" · "),
              showYear(group.show.premiered),
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
      />
      <CreditSection
        id="guest"
        title="Guest appearances"
        items={guestGroups}
        creditCount={data.guest_cast.length}
        keyOf={(group) => group.show.id}
        renderItem={(group) => (
          <EpisodeCreditCard show={group.show} credits={group.credits} label={characterLabel} />
        )}
      />
      {/* Its own section rather than merged into Crew with an episode qualifier.
          The two are different questions — "Executive Producer of Show" is a
          standing role, "Director of Show S3E7" is one night's work — and the
          glossary keeps `crew credit` and `episode crew credit` distinct for
          that reason. */}
      <CreditSection
        id="episode-crew"
        title="Episode crew"
        items={episodeCrewGroups}
        creditCount={data.episode_crew.length}
        keyOf={(group) => group.show.id}
        renderItem={(group) => (
          <EpisodeCreditCard
            show={group.show}
            credits={group.credits}
            label={(credit) => credit.role}
          />
        )}
      />
    </div>
  );
}

export function PersonPage() {
  const { personId } = useParams<{ personId: string }>();
  const id = Number(personId);
  const query = usePerson(id);

  // `/people/abc` gives NaN, which leaves the query disabled and therefore
  // permanently pending. A junk id is a bad URL, not a slow one.
  if (!Number.isFinite(id) || id <= 0) return <NotFoundPage />;
  if (query.isPending) return <LoadingState rows={1} />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />;
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  }

  const person = query.data;
  const dates = personDates(person);

  return (
    <article className="space-y-6">
      <header className="flex flex-col gap-6 sm:flex-row">
        <img
          src={person.image_original ?? person.image_medium ?? FALLBACK_HEADSHOT}
          alt=""
          className="w-40 self-start rounded border border-border bg-muted"
        />
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-semibold">{person.name}</h1>
          {dates || person.country_name ? (
            <p className="text-sm text-muted-foreground">
              {[dates, person.country_name].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </header>
      {/* Credits load separately from the header: the filmography is unbounded
          while the header is one row, so a slow or failed credits fetch must
          not blank the person out. */}
      <Credits personId={person.id} />
    </article>
  );
}
