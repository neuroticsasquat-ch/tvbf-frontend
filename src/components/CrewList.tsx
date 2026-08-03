import { useMemo, useState } from "react";
import { useShowCrew } from "@/api/shows";
import type { CrewMember } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { PersonChip } from "@/components/PersonChip";

/** Crew entries shown before the "Show all" affordance. Crew averages ~2× cast
 * and reaches 533 entries on The Simpsons, and those concentrate in a handful
 * of roles — so the budget is on entries, not on role groups. Capping groups
 * alone would still paint hundreds of chips from the first group. */
const COLLAPSED_COUNT = 12;

interface RoleGroup {
  role: string;
  members: CrewMember[];
}

/** Groups crew by role, preserving the API's order both for the roles (by first
 * appearance) and for the people within each role. */
function groupByRole(crew: CrewMember[]): RoleGroup[] {
  const groups = new Map<string, RoleGroup>();
  for (const member of crew) {
    const existing = groups.get(member.role);
    if (existing) existing.members.push(member);
    else groups.set(member.role, { role: member.role, members: [member] });
  }
  return [...groups.values()];
}

/** Takes whole groups in order until `budget` entries are used up, truncating
 * the group that straddles the limit. */
function takeMembers(groups: RoleGroup[], budget: number): RoleGroup[] {
  const taken: RoleGroup[] = [];
  let remaining = budget;
  for (const group of groups) {
    if (remaining <= 0) break;
    taken.push({ role: group.role, members: group.members.slice(0, remaining) });
    remaining -= Math.min(group.members.length, remaining);
  }
  return taken;
}

export function CrewList({ showId }: { showId: number }) {
  const { data, isError, error, refetch } = useShowCrew(showId);
  const [expanded, setExpanded] = useState(false);
  const groups = useMemo(() => groupByRole(data ?? []), [data]);

  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  // Same as cast: plenty of shows have no crew at all. Render nothing.
  if (!data || data.length === 0) return null;

  const visible = expanded ? groups : takeMembers(groups, COLLAPSED_COUNT);

  return (
    <section aria-labelledby="crew-heading">
      <h2 id="crew-heading" className="mb-3 text-lg font-semibold">
        Crew <span className="font-normal text-muted-foreground">({data.length})</span>
      </h2>
      <div className="space-y-4">
        {visible.map((group) => (
          <div key={group.role}>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">{group.role}</h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.members.map((member, i) => (
                // Credit rows carry no upstream id and one person can hold the
                // same role twice, so the index is part of the key.
                <li key={`${group.role}-${member.person.id}-${i}`}>
                  <PersonChip person={member.person} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {data.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 rounded text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : `Show all ${data.length}`}
        </button>
      )}
    </section>
  );
}
