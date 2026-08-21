import { cn } from "@/lib/cn";

interface Props {
  displayName: string;
  handle: string;
  /** Type scale, not layout. `row` is every list and card surface; `heading`
   * is `FriendProfilePage`'s `h1`. */
  size?: "row" | "heading";
}

/** One person, drawn as an entity: the display name over `@{handle}`
 * (NEU-1169 §4.2).
 *
 * **One component rather than seven copies of `{name} <span>@{handle}</span>`**,
 * which is this repo's settled answer to the same shape: `ShowPoster` assigns
 * every poster corner so no call site decides placement, `OwnerFacts` groups a
 * person's facts so attribution is structural rather than per-surface
 * discipline, and `rating.ts` owns one vocabulary for three kinds of rating.
 * Seven hand-rolled spans is precisely the drift those three exist to prevent.
 *
 * **Always stacked**, never inline. That is measured against the contract
 * rather than against today's values: a handle is 30 characters by contract
 * (NEU-1163 §1), and on a connections row — ~343px inside padding, less ~90px
 * of button — an inline `{name} @{handle}` has ~250px, about 35 characters at
 * `text-sm`. A 30-character handle beside even a short display name exceeds it.
 * `OwnerFacts` reached the same answer the same way, and its docstring records
 * the reasoning: the inline form "wraps unpredictably at exactly the width that
 * matters".
 *
 * **`size` is a variant, not a `className`**, on `ShowPoster`'s precedent —
 * anything else is a new surface making a decision that belongs here. Layout
 * *around* the block (how much of a flex row it takes) stays the surface's,
 * which is why the root sets `min-w-0` and no width.
 *
 * **The handle is rendered with its `@`.** The sigil is not stored — NEU-1163
 * §1.1 normalises it away — and is not part of the value; it is how a handle is
 * printed, and printing it is what makes `@tom_boone` recognisable as the thing
 * someone was handed.
 *
 * Placement and truncation are asserted **once**, in `UserIdentity.test.tsx`;
 * each surface's own test asserts only that it renders through the component
 * (`[data-user-identity]`), which is the tripwire against an eighth surface
 * hand-rolling one.
 */
export function UserIdentity({ displayName, handle, size = "row" }: Props) {
  return (
    <span data-user-identity className="flex min-w-0 flex-col">
      <span className={cn("truncate", size === "heading" ? "text-2xl font-semibold" : "text-sm")}>
        {displayName}
      </span>
      <span
        className={cn(
          "truncate font-normal text-muted-foreground",
          size === "heading" ? "text-sm" : "text-xs",
        )}
      >
        @{handle}
      </span>
    </span>
  );
}
