import type { PersonRef } from "@/api/types";

const FALLBACK_HEADSHOT =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><rect width='1' height='1' fill='%23e2e8f0'/></svg>";

interface Props {
  person: PersonRef;
  /** Secondary line under the name — the character played, or the crew role. */
  detail?: string | null;
}

/** Headshot + name for one person, with an optional secondary line.
 *
 * The name renders as plain text today. NEU-951 adds `/people/:id`; when it
 * lands, wrap the name in a `<Link to={`/people/${person.id}`}>` here and every
 * credit list picks the link up. */
export function PersonChip({ person, detail }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img
        src={person.image_medium ?? FALLBACK_HEADSHOT}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full bg-muted object-cover"
        loading="lazy"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{person.name}</p>
        {detail ? (
          <p className="truncate text-xs text-muted-foreground leading-tight">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}
