interface Props {
  watched: number;
  aired: number;
  upcoming: number;
  stack?: boolean;
  /** When true, render only the bar (no caption text below). The caller is
   * responsible for showing the watched/aired/upcoming numbers however it likes. */
  barOnly?: boolean;
}

export function WatchProgressBar({
  watched,
  aired,
  upcoming,
  stack = false,
  barOnly = false,
}: Props) {
  const pct = aired > 0 ? Math.round((watched / aired) * 100) : 0;
  return (
    <div className="mt-1">
      <div
        className="h-1.5 w-full rounded bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% watched`}
      >
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {barOnly ? null : stack ? (
        <>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {pct}% watched ({watched}/{aired})
          </p>
          {upcoming > 0 && (
            <p className="text-[10px] text-muted-foreground leading-tight">{upcoming} upcoming</p>
          )}
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {pct}% watched ({watched}/{aired}){upcoming > 0 && ` - ${upcoming} upcoming`}
        </p>
      )}
    </div>
  );
}
