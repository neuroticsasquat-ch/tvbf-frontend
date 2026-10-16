import { Button } from "@/components/ui/button";
import { throwTestError } from "@/lib/testError";

/** Unlinked page that throws a known error on demand, to confirm a deploy's
 * errors reach Bugsink with a symbolicated stack (NEU-1593). The throw is in a
 * click handler rather than in render so it escapes React and the router and is
 * caught by Sentry's global handler, like a real uncaught error would be. */
export function ErrorTestPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Error reporting test</h1>
      <p className="mt-2 text-muted-foreground">
        The button below throws an error that should appear in Bugsink.
      </p>
      <Button className="mt-4" variant="destructive" onClick={() => throwTestError()}>
        Throw test error
      </Button>
    </div>
  );
}
