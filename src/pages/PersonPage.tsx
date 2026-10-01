import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";
import { usePerson, usePersonCredits } from "@/api/people";
import { useShow } from "@/api/shows";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { cn } from "@/lib/cn";
import { NotFoundPage } from "./NotFoundPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabCount } from "@/components/TabCount";
import type { EpisodeRef, PersonOut } from "@/api/types";
import { episodeCountLabel } from "@/lib/episodeCount";
import {
  buildShowCards,
  characterLabel,
  seasonRows,
  type ShowCreditCard,
} from "./personCredits";

/** Cards shown per tab before the "Show all" affordance. Filmographies are
 * wildly uneven — Zachary Levi is on 60-odd shows — so both tabs collapse by
 * the same rule rather than the page guessing which one will be long. */
const COLLAPSED_COUNT = 12;

/** Rows an expanded card lists before, and between, each "Show more".
 *
 * Cards are genuinely unbounded: Debbie Griffin holds 8,010 episode-crew
 * credits on Jeopardy! alone, and a game show or soap will do that to anyone
 * who worked on it for years. Ten at a time keeps a grid cell a grid cell,
 * while every episode stays reachable (NEU-1512 §5.4). */
const ROWS_PER_PAGE = 10;

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

interface CreditSectionProps {
  id: string;
  title: string;
  cards: ShowCreditCard[];
  /** When the tab already shows the title + count, the panel heading is
   * visually hidden but kept in the DOM so `aria-labelledby` still resolves. */
  headingHidden?: boolean;
}

function CreditSection({ id, title, cards, headingHidden }: CreditSectionProps) {
  const [expanded, setExpanded] = useState(false);

  // An empty tab is hidden, so this never renders empty — but an empty header
  // reads as a broken section rather than an absent one, so guard anyway.
  if (cards.length === 0) return null;

  const visible = expanded ? cards : cards.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2
        id={`${id}-heading`}
        className={headingHidden ? "sr-only" : "mb-3 text-lg font-semibold"}
      >
        {/* Shows, not credits, since NEU-1512: with one card per show, the
            number of shows is the number the reader sees. */}
        {title} <span className="font-normal text-muted-foreground">({cards.length})</span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <li key={card.show.id}>
            <ShowCard card={card} />
          </li>
        ))}
      </ul>
      {cards.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 rounded text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : `Show all ${cards.length} shows`}
        </button>
      )}
    </section>
  );
}

/** One row under a card: a regular season or a credited episode. */
interface CardRow {
  key: string;
  to: string;
  /** What the row shows after the code — the episode name, the roles. */
  code: string;
  detail: string;
}

/** The rows of a card, season rows first (ascending), then episodes (newest
 * first). Season rows read their episode counts off the show's season list,
 * which the credits payload does not carry, so `fetchSeasons` fetches the show
 * — passed only by an expanded card, on the reader's click. An inline row
 * passes false and reads "Season 3" alone: most regulars are single-season
 * (79% of shows have one), and fetching for each would cost a person page a
 * dozen show requests on load (NEU-1512 §5.4, "on expand … rather than up
 * front"). */
function useCardRows(
  card: ShowCreditCard,
  { withLabels, fetchSeasons }: { withLabels: boolean; fetchSeasons: boolean },
): CardRow[] {
  const showQuery = useShow(fetchSeasons && card.seasons.length > 0 ? card.show.id : -1);
  const seasons = seasonRows(card.show.id, card.seasons, showQuery.data?.seasons).map(
    (row): CardRow => ({ key: `s${row.number}`, to: row.to, code: row.text, detail: "" }),
  );
  const episodes = card.episodes.map(
    (entry): CardRow => ({
      key: `e${entry.episode.id}`,
      to: `/episodes/${entry.episode.id}`,
      code: episodeCode(entry.episode),
      detail: [entry.episode.name, withLabels ? entry.labels.join(" · ") : null]
        .filter(Boolean)
        .join(" · "),
    }),
  );
  return [...seasons, ...episodes];
}

/** One row as a link. The whole row is the link, not just its code: the
 * episode name and role are the parts most likely to be aimed at, and leaving
 * them outside the anchor made the biggest target on the row inert. `block`
 * matters for the same reason — an inline anchor only covers its text.
 *
 * aria-label prefixes the show because two cards can otherwise expose rows
 * reading the same — the visible text is included verbatim, so WCAG 2.5.3
 * holds. That is why the separator below and the `join` here are one decision:
 * change one alone and the accessible name stops containing the visible string.
 */
function RowLink({ showName, row }: { showName: string; row: CardRow }) {
  return (
    <Link
      to={row.to}
      aria-label={`${showName} — ${[row.code, row.detail].filter(Boolean).join(" · ")}`}
      className="block truncate rounded px-1 py-1.5 text-xs leading-tight underline-offset-2 hover:bg-muted hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {row.code}
      {row.detail ? <span className="text-muted-foreground"> · {row.detail}</span> : null}
    </Link>
  );
}

function SingleRow({ card }: { card: ShowCreditCard }) {
  // The labels line above already says who they played, so the row does not
  // repeat it.
  const [row] = useCardRows(card, { withLabels: false, fetchSeasons: false });
  return <RowLink showName={card.show.name} row={row} />;
}

function ExpandedRows({ card }: { card: ShowCreditCard }) {
  const rows = useCardRows(card, { withLabels: true, fetchSeasons: true });
  const [shown, setShown] = useState(ROWS_PER_PAGE);
  const listed = rows.slice(0, shown);

  return (
    <>
      {/* Rows are full-width click targets, so they need to be tall enough and
          separated enough not to be hit by accident: py-1.5 takes each to ~27px,
          over WCAG 2.5.8's 24×24, and space-y-1 keeps neighbours apart. */}
      <ul className="mt-1 space-y-1 border-l border-border pl-2">
        {listed.map((row) => (
          <li key={row.key}>
            <RowLink showName={card.show.name} row={row} />
          </li>
        ))}
      </ul>
      {rows.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + ROWS_PER_PAGE)}
          aria-label={`Show more of ${card.show.name} (${listed.length} of ${rows.length} shown)`}
          className="mt-1 rounded px-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Show more
        </button>
      )}
    </>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** One show in a filmography (NEU-1512 §5.4): the show, how many episodes,
 * who they played or what they did — and, beneath, the seasons they were a
 * regular in and the episodes they were credited on. Nothing says "regular"
 * or "guest": the grain shows only in whether a row is a season or an episode.
 */
function ShowCard({ card }: { card: ShowCreditCard }) {
  const [open, setOpen] = useState(false);
  const { show } = card;
  const meta = [episodeCountLabel(card.episodeCount), showYear(show.premiered)]
    .filter(Boolean)
    .join(" · ");
  const rowCount = card.seasons.length + card.episodes.length;
  const labels = card.labels.join(" · ");

  const header = (
    <p className="truncate text-sm font-medium leading-tight">
      <Link
        to={`/shows/${show.id}`}
        className="rounded underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show.name}
      </Link>
      {meta ? <span className="font-normal text-muted-foreground"> · {meta}</span> : null}
    </p>
  );

  // No rows: a series crew credit, which links nowhere narrower than the show.
  // One row: shown in place of the disclosure, so the common case of one
  // season or one episode gains no expander.
  if (rowCount <= 1) {
    return (
      <div className="min-w-0">
        {header}
        {labels ? (
          <p className="truncate text-xs text-muted-foreground leading-tight">{labels}</p>
        ) : null}
        {rowCount === 1 ? <SingleRow card={card} /> : null}
      </div>
    );
  }

  const summary = [
    labels,
    card.seasons.length > 0 ? plural(card.seasons.length, "season") : null,
    card.episodes.length > 0 ? plural(card.episodes.length, "episode") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      {header}
      {/* Two things this button needs that are easy to miss.

          The chevron is the only thing marking it as interactive. The repo's
          other disclosures carry that in the verb, but this one's text is a
          summary, and a noun phrase reads as a label — in a truncated grid cell
          there is no room for verb text without crowding out the summary.

          The aria-label adds the show, which is the card's visible heading but
          sits in a sibling element and so is not part of this control's
          accessible name. Without it, a director of three episodes each of two
          shows gets two buttons both announced "Director · 3 episodes". The
          visible text stays a suffix of the accessible name, so WCAG 2.5.3
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
      {open && <ExpandedRows card={card} />}
    </div>
  );
}

function Credits({ personId }: { personId: number }) {
  const { data, isPending, isError, error, refetch } = usePersonCredits(personId);
  const [searchParams, setSearchParams] = useSearchParams();

  if (isPending) return <LoadingState rows={1} />;
  // A failed request must not look like the (very common) no-credits case.
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  // Every list counts. Episode crew is reachable by no other route upstream, so
  // a director with nothing else is a real and reachable shape — omitting it
  // here would say "No credits yet." over a populated Crew tab.
  const total =
    data.cast.length + data.crew.length + data.guest_cast.length + data.episode_crew.length;
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No credits yet.</p>;
  }

  // One card per show per tab. The API keeps regular and guest credits apart
  // (and series and episode crew); the page does not label either, so here is
  // where each pair meets (NEU-1512 §5.4).
  const castCards = buildShowCards({
    showLevel: data.cast,
    episodeLevel: data.guest_cast,
    label: characterLabel,
    seasonsOf: (credit) => credit.seasons,
    lastCreditedOf: (credit) => credit.last_credited,
  });
  const crewCards = buildShowCards({
    showLevel: data.crew,
    episodeLevel: data.episode_crew,
    label: (credit) => credit.role,
  });

  // `?tab=guest` and `?tab=episode-crew` are the four-tab page's values; links
  // carrying them still land on the tab that now holds those credits.
  const requested = searchParams.get("tab");
  const wanted = requested === "crew" || requested === "episode-crew" ? "crew" : "cast";
  const tab =
    wanted === "cast" && castCards.length === 0
      ? "crew"
      : wanted === "crew" && crewCards.length === 0
        ? "cast"
        : wanted;

  function selectTab(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "cast") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  return (
    <Tabs value={tab} onValueChange={selectTab}>
      <TabsList className="w-full justify-start overflow-x-auto">
        {castCards.length > 0 && (
          <TabsTrigger value="cast">
            Cast <TabCount value={castCards.length} />
          </TabsTrigger>
        )}
        {crewCards.length > 0 && (
          <TabsTrigger value="crew">
            Crew <TabCount value={crewCards.length} />
          </TabsTrigger>
        )}
      </TabsList>
      {castCards.length > 0 && (
        <TabsContent value="cast">
          <CreditSection id="cast" title="Cast" cards={castCards} headingHidden />
        </TabsContent>
      )}
      {crewCards.length > 0 && (
        <TabsContent value="crew">
          <CreditSection id="crew" title="Crew" cards={crewCards} headingHidden />
        </TabsContent>
      )}
    </Tabs>
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
