import { ConfirmDialog } from "@/components/ConfirmDialog";

/** The confirmation every removal from My Shows asks first (NEU-1511 §3.3).
 *
 * It owns the words and nothing else, so the copy exists once across its two
 * callers — `MyShowsButton` and `MyShowsToggle`, which were deliberately not
 * converged (NEU-1187 D6). Each caller keeps its own `confirming` state and
 * renders this conditionally, the shape `ConfirmDialog` expects; lifting that
 * state in here would give the wrapper a second job (§4 D5).
 *
 * The description says what is **kept**, because that is the fact a person
 * hesitating over "Remove" needs — and because the watch-history dialog one
 * tab over says "This cannot be undone", which this one must not read like. */
export function RemoveFromMyShowsDialog({
  showName,
  pending,
  onConfirm,
  onClose,
}: {
  showName: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title="Remove from My Shows"
      description={`Remove ${showName} from My Shows? Your watch history and rating are kept.`}
      confirmLabel="Remove"
      destructive
      pending={pending}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
