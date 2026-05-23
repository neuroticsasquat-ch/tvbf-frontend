import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitFeedback } from "@/api/me";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SUBJECT_MAX = 120;
const BODY_MAX = 5000;

export function FeedbackDialog({ open, onOpenChange }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useSubmitFeedback();

  const reset = () => {
    setSubject("");
    setBody("");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    try {
      await mutation.mutateAsync({ subject, body });
      toast.success("Thanks — we got it.");
      reset();
      onOpenChange(false);
    } catch {
      setError("Could not send feedback. Try again later.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s broken, what&apos;s confusing, or what you&apos;d like to see.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="feedback-subject">Subject</Label>
            <Input
              id="feedback-subject"
              value={subject}
              maxLength={SUBJECT_MAX}
              onChange={(e) => setSubject(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feedback-body">Details</Label>
            <Textarea
              id="feedback-body"
              value={body}
              maxLength={BODY_MAX}
              rows={6}
              onChange={(e) => setBody(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={
              mutation.isPending || subject.trim().length === 0 || body.trim().length === 0
            }
          >
            {mutation.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
