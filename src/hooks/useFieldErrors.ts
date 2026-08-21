import { useCallback, useMemo, useState } from "react";

import { ApiError } from "@/api/client";

/** The id of the element holding a field's message, derived from the field
 * name so the input's `aria-describedby` and the message's `id` cannot drift
 * apart. `FieldError` derives the same id from the same name. */
export function fieldErrorId(name: string): string {
  return `${name}-error`;
}

/** What `capture` learned from an error. `handled` is false when the response
 * carried no field messages at all, which is the caller's signal to fall
 * through to whatever it says about a status. */
export interface FieldErrorCapture {
  handled: boolean;
  /** Messages naming a field this form has no input for, keyed by name. A
   * caller with its own copy for one of those conditions reads it from here;
   * the schema's own sentence is written for a developer, and a form that
   * already says something better about the same refusal should say that. */
  unowned: Record<string, string>;
  /** `unowned` joined — the default banner text, for a caller with nothing
   * better to say. Null when every message landed on an input. */
  banner: string | null;
}

/** Per-field validation messages for one form (NEU-1196).
 *
 * The client parses FastAPI's list-shaped `detail` into `ApiError.fieldErrors`;
 * this is the form's half — which of those messages this form has an input
 * for, what happens to the rest, and when a message stops being true.
 *
 * It is a hook rather than a helper because all three of those are stateful,
 * and because the `aria-describedby` join is where a hand-rolled copy breaks:
 * an input that already has help text must keep pointing at it *as well as* at
 * the message, and an input without help text must not point at an id that
 * does not exist. `fieldProps` does that join once instead of once per input.
 *
 * `ownFields` is the request fields this form has an input for. A request
 * carries fields a form does not render — the reset token comes from the URL —
 * and a message about one of those must still reach the user, so it goes to the
 * banner rather than being dropped.
 *
 * **Extracted at the second copy, where this codebase's stated threshold is the
 * third** (`useFocusAfterRemoval`, NEU-1193). The departure is deliberate and
 * narrow: the third partial consumer, `SettingsPage`'s display-name editor, has
 * one field and its own single-error state, so it is left alone rather than bent
 * to fit. What forced the extraction early is that a code review named the
 * `aria-describedby` join as the specific thing a hand-written copy gets wrong,
 * one commit before a second copy was written — the threshold exists to stop
 * premature abstraction, not to require a known-fragile shape be copied first.
 */
export function useFieldErrors(ownFields: readonly string[]) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // `ownFields` is a literal at every call site, so it is a new array on every
  // render; keying the set on its contents keeps the callbacks stable.
  const key = ownFields.join(" ");
  // Guarded rather than a bare split: `"".split(" ")` is `[""]`, which would
  // read an empty field name as owned.
  const own = useMemo(() => new Set(key ? key.split(" ") : []), [key]);

  const reset = useCallback(() => setFieldErrors({}), []);

  /** Drop one field's message — call it as that input changes, so an input is
   * not still marked invalid while the user is fixing it. */
  const clearField = useCallback((name: string) => {
    setFieldErrors((prev) =>
      name in prev ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== name)) : prev,
    );
  }, []);

  /** Set one field's message from a check the form ran itself, before or
   * instead of a request (NEU-1169 §3.1).
   *
   * Client-side and server-side messages share this one store on purpose: they
   * are the same message in the same place, and the `aria-describedby` join
   * that puts them there is the thing a hand-written copy gets wrong. A form
   * holding its own `useState` beside this one would have to rebuild that join
   * for one field. `capture` overwrites what this set, which is the right
   * precedence — the server's sentence is the authoritative one. */
  const setFieldError = useCallback((name: string, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [name]: message }));
  }, []);

  /** Take the field messages off a rejected request.
   *
   * Discriminates on the shape rather than on the status, as the client does:
   * FastAPI only produces this on a 422, but a schema-level refusal need not
   * arrive as one (NEU-1163's taken handle may well be a 409), and checking the
   * status first would drop it. */
  const capture = useCallback(
    (err: unknown): FieldErrorCapture => {
      if (!(err instanceof ApiError) || !err.fieldErrors) {
        return { handled: false, unowned: {}, banner: null };
      }
      setFieldErrors(err.fieldErrors);
      const unowned = Object.entries(err.fieldErrors).filter(([name]) => !own.has(name));
      return {
        handled: true,
        unowned: Object.fromEntries(unowned),
        banner: unowned.length > 0 ? unowned.map(([, msg]) => msg).join(" ") : null,
      };
    },
    [own],
  );

  /** The aria attributes for one input. `describedBy` is whatever the input
   * already points at (help text); the message's id is prepended to it when
   * there is a message, and it is left exactly as it was when there is not. */
  const fieldProps = useCallback(
    (name: string, describedBy?: string) => {
      const message = fieldErrors[name];
      return {
        "aria-invalid": message ? true : undefined,
        "aria-describedby": message
          ? [fieldErrorId(name), describedBy].filter(Boolean).join(" ")
          : describedBy,
      } as const;
    },
    [fieldErrors],
  );

  return { fieldErrors, fieldProps, clearField, setFieldError, capture, reset };
}
