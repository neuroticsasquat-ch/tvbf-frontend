import { Link } from "react-router";
import type { PersonRef } from "@/api/types";

const FALLBACK_HEADSHOT =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><rect width='1' height='1' fill='%23e2e8f0'/></svg>";

interface Props {
  person: PersonRef;
  /** Secondary line under the name — the character played, or the crew role. */
  detail?: string | null;
  /** A short quantity appended to the secondary line, e.g. "12 episodes". It
   * shares that line rather than claiming a third, which would outgrow the
   * headshot beside it, and it is the half that survives truncation — a long
   * character name gives way to it, not the other way round. */
  meta?: string | null;
}

/** Headshot + name for one person, with an optional secondary line. The name
 * links to the person page, so every credit list picks the link up for free. */
export function PersonChip({ person, detail, meta }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img
        src={person.image_medium ?? FALLBACK_HEADSHOT}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full bg-muted object-cover"
        loading="lazy"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">
          <Link
            to={`/people/${person.id}`}
            className="rounded underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {person.name}
          </Link>
        </p>
        {detail || meta ? (
          // `items-center`, not `items-baseline`: a truncating child is an
          // overflow container, whose baseline is synthesized from its border
          // box rather than its text, so baseline alignment visibly misaligns
          // the two halves.
          <p className="flex items-center gap-1 text-xs text-muted-foreground leading-tight">
            {detail ? <span className="min-w-0 truncate">{detail}</span> : null}
            {detail && meta ? (
              <span aria-hidden="true" className="shrink-0">
                ·
              </span>
            ) : null}
            {meta ? <span className="shrink-0 tabular-nums">{meta}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
