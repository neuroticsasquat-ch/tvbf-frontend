import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="rounded border border-destructive/40 bg-destructive/5 p-6 text-center"
      role="alert"
    >
      <p className="font-medium text-destructive">Something went wrong</p>
      {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} variant="outline">
          Retry
        </Button>
      ) : null}
    </div>
  );
}
