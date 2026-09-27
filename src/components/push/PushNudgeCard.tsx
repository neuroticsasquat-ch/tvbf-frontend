import { X } from "lucide-react";
import { supportState } from "@/lib/push";
import { dismissPushNudge, usePushNudge } from "@/lib/pushNudge";
import { AddToHomeScreenSteps } from "./AddToHomeScreenSteps";
import { InstallAppButton } from "./InstallAppButton";
import { TurnOnPushButton } from "./TurnOnPushButton";

/** The one-time post-add nudge (push-notifications project spec §6.4), drawn
 * by `AppShell` over whichever page the add happened on. It never asks for
 * permission by appearing — only its Turn on button does. Dismissing or acting
 * closes it for good. */
export function PushNudgeCard() {
  const showName = usePushNudge();
  if (showName === null) return null;
  // `offerPushNudge` already checked this is `prompt` or `ios_needs_install`.
  const iosNeedsInstall = supportState() === "ios_needs_install";

  return (
    <aside
      aria-labelledby="push-nudge-heading"
      // Above the mobile bottom nav, which grows by the home-indicator inset;
      // bottom-right from md, where there is no bottom nav.
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 space-y-3 rounded border border-border bg-background p-4 text-sm shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:w-96"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="push-nudge-heading" className="font-semibold">
          Get told when {showName} airs
        </h2>
        <button
          type="button"
          onClick={dismissPushNudge}
          aria-label="Dismiss"
          className="-m-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {iosNeedsInstall ? (
        <AddToHomeScreenSteps />
      ) : (
        <p className="text-muted-foreground">
          Turn on notifications and hear when a new episode is out.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!iosNeedsInstall && <TurnOnPushButton onAct={dismissPushNudge} />}
        <InstallAppButton onAct={dismissPushNudge} />
      </div>
    </aside>
  );
}
