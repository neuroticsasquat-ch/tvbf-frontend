import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** The one confirmation modal, promoted out of `components/connections/` and
 * rebuilt on `ui/dialog` (NEU-1168 §5). Props are unchanged, so every existing
 * caller reads the same.
 *
 * The version this replaces was a hand-rolled `role="dialog"` overlay with **no
 * focus trap, no Escape and no focus restore**, and nothing hiding the page
 * behind it from assistive tech. Radix supplies all four — the last through
 * `aria-hidden` on everything outside the portal rather than through
 * `aria-modal`, which it deliberately does not set. The admin disable/enable confirmations are exactly the ceremony
 * NEU-1168 AC 2 is about — the last place to inherit an untrapped modal — and a
 * second area needing the component is this repo's own extraction threshold
 * (NEU-1193 at the third focus-after-removal, NEU-1057 at the third library
 * mark).
 *
 * It is a **confirmation, not a form**: no inputs, one decision, two buttons.
 * `DeleteAccountDialog` and `ChangePasswordDialog` hold fields and are
 * deliberately left alone rather than folded in — that would widen this
 * contract, and converting the account-deletion flow inside a moderation
 * ticket is where a regression is most expensive.
 *
 * Rendering is conditional at every call site (`{pending && <ConfirmDialog …>}`),
 * which is what the previous overlay required; `open` is therefore hard-coded
 * true and dismissal is reported through `onClose` alone — the same one-way
 * signal the callers already pass. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
