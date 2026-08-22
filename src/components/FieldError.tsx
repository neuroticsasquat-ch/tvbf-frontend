import { fieldErrorId } from "@/hooks/useFieldErrors";

/** One field's validation message, under the input it is about (NEU-1196).
 *
 * Renders nothing when there is no message, so a call site can sit
 * unconditionally beside its input. The id comes from `fieldErrorId`, the same
 * derivation `useFieldErrors`' `fieldProps` uses for `aria-describedby`. */
export function FieldError({ name, message }: { name: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={fieldErrorId(name)} role="alert" className="mt-1 text-sm text-red-600">
      {message}
    </p>
  );
}
