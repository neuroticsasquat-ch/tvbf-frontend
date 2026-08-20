import { useState } from "react";
import { Flag } from "lucide-react";

import { ApiError } from "@/api/client";
import { useSubmitReport } from "@/api/reports";
import { useBlockUser } from "@/components/connections/useBlockUser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REASON_MAX = 5000;

type Failure = "rate_limited" | "generic";

/** The one control that reports another user (NEU-1168 §3).
 *
 * It owns the button, the dialog, the `POST /reports` mutation and the block
 * hand-off — `DismissRecommendationButton`'s seam verbatim, which is what makes
 * its four call sites one-liners. `onBlocked` is not the block mutation coming
 * back up: it reports *that a block landed*, so the surface can react.
 *
 * **It goes where the person is the subject of the row, never where their name
 * is a byline on a piece of content** (§2). That rule puts it on
 * `FriendProfilePage`, `ConnectionsList`, `RequestsInbox`'s **incoming** rows
 * and `BlockedList`, and keeps it off outgoing requests, `FindPeople`,
 * `FriendRatingsList`, `FeedItemRow` and `OwnerFacts` — every one of which
 * links the name to `/users/{id}`, which carries it.
 *
 * **There is no verification gate here, and adding one would be a bug**
 * (NEU-1162 §7.2). A verified mailbox is the price of *outreach*; a report
 * touches the maintainer, not the reported user. Gating it would silence the
 * newest accounts — exactly who a griefer targets. `FindPeople`'s `gated` /
 * `isEmailNotVerified` pattern sits two lines from a Connect button that *is*
 * gated, and is deliberately not copied onto this one.
 *
 * **`canBlock` is a prop, never a `["blocks"]` read.** `BlockedList` passes
 * `false` because the person is already blocked and step 2 then says so.
 * This is `MyShowsButton`'s contract: the control takes the answer, never the
 * sources — reading the cache here would fire a `GET /me/blocks` from the
 * profile page and the requests inbox to learn something the calling surface
 * already knows.
 *
 * **Both variants' accessible name carries the person's name**, for the reason
 * NEU-1187 requires it of `MyShowsButton`: the compact chip has no visible text
 * at all, and twenty rows render twenty identical controls. `Flag` is the
 * glyph, and it is shared with no other control in the app. */
export function ReportUserButton({
  userId,
  userName,
  variant = "compact",
  canBlock = true,
  onBlocked,
}: {
  userId: string;
  userName: string;
  variant?: "labelled" | "compact";
  /** Whether step 2 offers blocking. `false` where the caller already knows the
   * person is blocked — offering an action the app knows is pointless is the
   * small dishonesty AC 5 exists against. */
  canBlock?: boolean;
  /** Fires once a block has been issued from step 2, so a surface that resolves
   * this person out of a cache the block empties can navigate away. */
  onBlocked?: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [filed, setFiled] = useState(false);
  const submit = useSubmitReport();
  const block = useBlockUser();

  const label = `Report ${userName}`;

  function close() {
    setOpen(false);
    // The dialog closing at any point is a complete flow: the report is filed
    // the moment the 204 lands, and step 2 is information and an offer, never a
    // required step.
    setReason("");
    setFailure(null);
    setFiled(false);
  }

  async function send() {
    setFailure(null);
    try {
      await submit.mutateAsync({ reportedUserId: userId, reason });
      setFiled(true);
    } catch (e) {
      // The typed reason is deliberately **not** cleared. Destroying someone's
      // written account of harassment over a refusal that is explicitly
      // temporary is the worst outcome available here (§3.5).
      setFailure(e instanceof ApiError && e.status === 429 ? "rate_limited" : "generic");
    }
  }

  function blockAndClose() {
    block.mutate(userId);
    // Reported *before* the request settles, unlike `onDismissed` /`onRemoved`,
    // which fire from `mutate`'s `onSuccess`. `useBlockUser` is optimistic and
    // empties the connections cache in `onMutate`, so `FriendProfilePage` — the
    // one caller that resolves its subject out of that cache — is already
    // showing "User not found" by the time a success callback would run.
    // Waiting would mean parking the reader on that screen for a round trip as
    // the direct result of a deliberate act. A failed block rolls itself back
    // and raises its own toast; the reader is then on the connections list,
    // which is a truthful place to be.
    onBlocked?.(userId);
    close();
  }

  return (
    <>
      {variant === "labelled" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          aria-label={label}
        >
          <Flag className="h-3.5 w-3.5 mr-1" aria-hidden />
          Report
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title="Report this user"
          className="p-1.5 text-muted-foreground hover:text-foreground"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur">
            <Flag className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent>
          {filed ? (
            <Filed
              userName={userName}
              canBlock={canBlock}
              blocking={block.isPending}
              onBlock={blockAndClose}
              onDone={close}
            />
          ) : (
            <Form
              userName={userName}
              reason={reason}
              onReasonChange={setReason}
              failure={failure}
              pending={submit.isPending}
              onCancel={close}
              onSend={send}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Step 1. A bare free-text reason and nothing else.
 *
 * **No category `Select` and no quick-pick chips.** The backend stores one
 * `reason` column and no category, so a taxonomy could only be a client-side
 * string convention the server cannot enforce, parse or filter on — and it is
 * wrong the first time a report does not fit the boxes. Prefilled chips fail
 * more softly the same way: the report then arrives half-templated and the
 * specific detail is the part most likely to be left off. The reporter's own
 * words are what an admin wants to re-read three months later. */
function Form({
  userName,
  reason,
  onReasonChange,
  failure,
  pending,
  onCancel,
  onSend,
}: {
  userName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  failure: Failure | null;
  pending: boolean;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Report {userName}</DialogTitle>
        <DialogDescription>
          A person reads every report. Tell us what happened, in your own words.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="report-reason">What happened?</Label>
          <Textarea
            id="report-reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={6}
            onChange={(e) => onReasonChange(e.target.value)}
            disabled={pending}
          />
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure === "rate_limited"
              ? // Names no number and parses no header (§3.5). The cap is a
                // configurable server constant, so "5 a day" in client copy is
                // a second place for it to be wrong, and `ApiError` carries no
                // headers to read `Retry-After` off. A 24-hour window makes
                // "tomorrow" correct in every case but the one where the user
                // retries early and reads the same sentence again.
                "You have filed several reports recently. You can file another one tomorrow — this report was not sent."
              : "Could not send that report. Try again later."}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={onSend} disabled={pending || reason.trim().length === 0}>
          {pending ? "Sending…" : "Send report"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Step 2, in the *same* dialog.
 *
 * A toast was rejected for this: the sentence about what does and does not
 * happen next is precisely the kind a disappearing toast fails to deliver, and
 * a considered second decision does not belong in something that auto-dismisses
 * (§3.3). An inline panel on the page was rejected because four surfaces would
 * each need somewhere to put it.
 *
 * Blocking is offered as a **separate act with separate consequences**, never
 * as something the report did implicitly (AC 5). */
function Filed({
  userName,
  canBlock,
  blocking,
  onBlock,
  onDone,
}: {
  userName: string;
  canBlock: boolean;
  blocking: boolean;
  onBlock: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Report received</DialogTitle>
        <DialogDescription>
          A person will read this. Nothing happens to {userName}&apos;s account automatically — no
          automatic warning, no automatic suspension.
        </DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        {canBlock
          ? `Reporting ${userName} does not block them. Blocking is a separate action, and it takes effect right away.`
          : `You have already blocked ${userName}, so they cannot reach you.`}
      </p>
      <DialogFooter>
        {canBlock ? (
          <Button type="button" variant="destructive" onClick={onBlock} disabled={blocking}>
            Block {userName}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
