import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { usePerson, usePersonCredits } from "@/api/people";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import type { EpisodeRef, PersonOut } from "@/api/types";

/** Entries shown per section before the "Show all" affordance. Sections are
 * wildly uneven — Zachary Levi is 11 cast / 0 crew / 61 guest — and the guest
 * section is usually the largest, so every section collapses by the same rule
 * rather than the page guessing which one will be long. */
const COLLAPSED_COUNT = 12;

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
  linkLabel,
}: {
  to: string;
  title: string;
  detail?: string | null;
  /** Overrides the link's accessible name. Needed only where one target can
   * appear more than once in a section: an episode-crew credit repeats the same
   * episode per role, so the visible title alone would give a screen reader two
   * identically-named links to the same href. The detail line disambiguates
   * them visually but is not part of the link's name. */
  linkLabel?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-tight">
        <Link
          to={to}
          aria-label={linkLabel}
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
  items: T[];
  renderItem: (item: T) => ReactNode;
}

function CreditSection<T>({ id, title, items, renderItem }: CreditSectionProps<T>) {
  const [expanded, setExpanded] = useState(false);

  // Sections hide entirely when empty. 0 / 1 / 0 is a common shape in the
  // mirror, and an empty header reads as a broken section, not an absent one.
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="mb-3 text-lg font-semibold">
        {title} <span className="font-normal text-muted-foreground">({items.length})</span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, i) => (
          // Credit rows carry no upstream id and upstream repeats person/show
          // pairs, so there is no natural key. The index is safe here: the list
          // is one query result rendered as-is, never reordered or spliced.
          <li key={i}>{renderItem(item)}</li>
        ))}
      </ul>
      {items.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 rounded text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
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

  return (
    <div className="space-y-8">
      {/* The API orders each group deliberately — cast and crew by show premiere
          descending, guest and episode-crew credits by air date descending with
          undated episodes last. Never re-sort here. */}
      <CreditSection
        id="cast"
        title="Cast"
        items={data.cast}
        renderItem={(credit) => (
          <CreditRow
            to={`/shows/${credit.show.id}`}
            title={credit.show.name}
            detail={[
              credit.voice ? `${credit.character.name} (voice)` : credit.character.name,
              showYear(credit.show.premiered),
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
      />
      <CreditSection
        id="crew"
        title="Crew"
        items={data.crew}
        renderItem={(credit) => (
          <CreditRow
            to={`/shows/${credit.show.id}`}
            title={credit.show.name}
            detail={[credit.role, showYear(credit.show.premiered)].filter(Boolean).join(" · ")}
          />
        )}
      />
      <CreditSection
        id="guest"
        title="Guest appearances"
        items={data.guest_cast}
        renderItem={(credit) => (
          // Linking to the episode, not the show: a guest credit is about one
          // episode, and the payload carries the show name so "Show — S2E11"
          // needs no second round trip.
          <CreditRow
            to={`/episodes/${credit.episode.id}`}
            title={`${credit.show.name} — ${episodeCode(credit.episode)}`}
            detail={[
              credit.episode.name,
              credit.voice ? `${credit.character.name} (voice)` : credit.character.name,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
      />
      {/* Its own section rather than merged into Crew with an episode qualifier.
          The two are different questions — "Executive Producer of Show" is a
          standing role, "Director of Show S3E7" is one night's work — and the
          glossary keeps `crew credit` and `episode crew credit` distinct for
          that reason. They also point at different things: Crew links to the
          show, this links to the episode. */}
      <CreditSection
        id="episode-crew"
        title="Episode crew"
        items={data.episode_crew}
        renderItem={(credit) => (
          <CreditRow
            to={`/episodes/${credit.episode.id}`}
            title={`${credit.show.name} — ${episodeCode(credit.episode)}`}
            detail={[credit.episode.name, credit.role].filter(Boolean).join(" · ")}
            // One person is credited on one episode more than once often enough
            // to matter — Story and Teleplay on the same episode is routine — so
            // the role goes in the accessible name. Without it a screen reader
            // lists two identical links to the same episode.
            linkLabel={`${credit.show.name} — ${episodeCode(credit.episode)} — ${credit.role}`}
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
