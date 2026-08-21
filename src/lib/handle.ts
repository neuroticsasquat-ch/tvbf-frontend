/** The handle's shape, and the normalisation the server applies before it
 * checks that shape (NEU-1169 §3.1, §3.2).
 *
 * One module over one normaliser and one regex, used by both write sites — the
 * signup form and the settings editor — on the backend's own shape: `POST
 * /signup` and `PATCH /me/handle` share a single `Handle` alias precisely
 * because "a rule applied to the raw string at one door and the stripped string
 * at the other is two rules" (NEU-1163 §1.1).
 *
 * **The shape is the only rule mirrored here.** Reserved words, the
 * `user_<8 hex>` pattern and uniqueness are the server's, and arrive as a 422
 * or a 409 that `useFieldErrors` renders against the input (NEU-1169 D2).
 * `RESERVED_HANDLES` is a snapshot nothing tracks and it already exists twice;
 * a third copy would be the one that drifts, and it would drift *toward
 * permissive* — telling a visitor `@moderator` is fine right up until the
 * server refuses it. The shape is the exception because it is stable, it is
 * already printed verbatim in the help text, and it is the only rule a user
 * can fix while typing.
 */

/** NEU-1163 §1: three to thirty characters of `a-z`, `0-9` and `_`, starting
 * with a letter. Applied to the **normalised** form, never the raw one. */
export const HANDLE_SHAPE = /^[a-z][a-z0-9_]{2,29}$/;

/** The sentence shown when the shape check refuses. Deliberately the same rule
 * the signup help text already states, in the same words. */
export const HANDLE_SHAPE_MESSAGE =
  "Handles are 3–30 characters: lowercase letters, numbers and underscores, starting with a letter.";

/** Predict what the server will store for what was typed.
 *
 * Trim, strip **one** leading `@`, trim again, lowercase — `removeprefix`
 * rather than `lstrip`, because `@@tom` is not a handle anybody was handed and
 * accepting it would make this a second, looser rule rather than a spelling
 * correction (NEU-1163 §1.1).
 *
 * This is a *prediction*, not an authority: the raw string still goes on the
 * wire, so the server stays the one place that normalises. Validating the raw
 * string instead would make the SPA stricter than the server and refuse
 * `@TomBoone`, which the backend deliberately accepts.
 */
export function normaliseHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").trim().toLowerCase();
}

/** Whether what was typed normalises to something the server's shape rule
 * accepts. `admin` and `user_3f4a2b1c` both pass here and are refused by the
 * server — which is the point of stopping at shape. */
export function isHandleShapeValid(raw: string): boolean {
  return HANDLE_SHAPE.test(normaliseHandle(raw));
}
