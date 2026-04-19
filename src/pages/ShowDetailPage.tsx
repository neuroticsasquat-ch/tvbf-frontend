import { Link, useParams } from "react-router";
import { useShow } from "@/api/shows";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import { SafeHtml } from "@/components/SafeHtml";
import { Badge } from "@/components/ui/badge";

function yearRange(premiered: string | null, ended: string | null) {
  if (!premiered) return "—";
  const start = premiered.slice(0, 4);
  const end = ended ? ended.slice(0, 4) : "present";
  return start === end ? start : `${start} – ${end}`;
}

export function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const showId = Number(id);
  const query = useShow(showId);

  if (query.isPending) return <LoadingState rows={1} />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />;
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  }
  const show = query.data;
  return (
    <article className="space-y-6">
      <header className="flex flex-col gap-6 sm:flex-row">
        {show.image_medium ? (
          <img
            src={show.image_medium}
            alt=""
            className="w-40 rounded border border-border object-cover"
          />
        ) : null}
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-semibold">{show.name}</h1>
          <p className="text-sm text-muted-foreground">
            {yearRange(show.premiered, show.ended)}
            {show.network?.name ? ` · ${show.network.name}` : ""}
            {show.status ? ` · ${show.status}` : ""}
            {show.runtime ? ` · ${show.runtime} min` : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            {show.genres.map((g) => (
              <Badge key={g} variant="secondary">
                {g}
              </Badge>
            ))}
          </div>
          <SafeHtml html={show.summary} className="prose prose-sm max-w-none pt-2" />
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Seasons</h2>
        {show.seasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No seasons available.</p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {show.seasons.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/shows/${show.id}/episodes?season=${s.number}`}
                  className="flex items-center justify-between px-4 py-2 hover:bg-muted"
                >
                  <span>Season {s.number}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.episode_order ?? "?"} episodes
                    {s.premiere_date ? ` · ${s.premiere_date.slice(0, 4)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
