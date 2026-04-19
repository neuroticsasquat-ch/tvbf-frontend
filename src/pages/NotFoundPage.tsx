import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-muted-foreground">We couldn't find what you were looking for.</p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Back to browse
      </Link>
    </div>
  );
}
