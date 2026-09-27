import { toast } from "sonner";
import { isPushUnavailable, useSubscribePush, useVapidKey } from "@/api/push";
import { PushPermissionError } from "@/lib/push";

/** The one control that asks for notification permission, shared by Settings
 * and the post-add nudge card (push-notifications project spec §6.3, §6.4).
 * `onAct` fires after the permission request has started, never before it. */
export function TurnOnPushButton({ onAct }: { onAct?: () => void }) {
  const key = useVapidKey();
  const { subscribe, isPending } = useSubscribePush();

  if (isPushUnavailable(key.error)) {
    return <p className="text-muted-foreground">Notifications aren&apos;t available right now.</p>;
  }

  // Not async: `subscribe` has to run in this handler's own tick so the
  // permission prompt sees the click (see `subscribe` in lib/push.ts).
  function onClick() {
    if (!key.data) return;
    subscribe(key.data).catch((e: unknown) => {
      // A dismissed or refused prompt is not an error; the refetched state
      // line already says what happened.
      if (e instanceof PushPermissionError) return;
      // The toast is generic; the cause (no worker registered, the browser's
      // push service refusing, the POST failing) is only ever visible here.
      console.error("Turning on notifications failed", e);
      toast.error("Couldn't turn on notifications. Try again.");
    });
    onAct?.();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!key.data || isPending}
      className="rounded bg-foreground text-background px-3 py-1 disabled:opacity-50"
    >
      {isPending ? "Turning on…" : "Turn on notifications"}
    </button>
  );
}
