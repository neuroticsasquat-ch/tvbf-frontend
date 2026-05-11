import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/cn";

interface Props {
  html: string | null;
  className?: string;
  /** Number of lines to clamp to when collapsed. */
  clampLines?: number;
}

/** Renders sanitized HTML inside a line-clamped container with a Read
 * more / Read less toggle. The toggle only appears when the rendered
 * content exceeds the clamp; if it fits, the summary just renders inline.
 * State is per-instance and resets on unmount. */
export function CollapsibleSummary({ html, className, clampLines = 4 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const clean = useMemo(() => (html ? DOMPurify.sanitize(html) : ""), [html]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // When expanded, the clamp is removed so scrollHeight === clientHeight;
      // we still keep the toggle visible (so users can collapse back) via the
      // `expanded || overflows` predicate below.
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clean, clampLines, expanded]);

  if (!html) return null;

  const clampStyle: CSSProperties = expanded
    ? {}
    : {
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: clampLines,
        overflow: "hidden",
      };

  const showToggle = overflows || expanded;

  // Tapping anywhere in the summary toggles expand/collapse — convenience for
  // touch users. Skip toggling when the click lands on an anchor (let the link
  // navigate instead) or when the user is dragging to select text (selection
  // type is "Range" rather than "Caret").
  function onSummaryClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!showToggle) return;
    const target = e.target as HTMLElement;
    if (target.closest("a")) return;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.type === "Range") return;
    setExpanded((v) => !v);
  }

  return (
    <div>
      <div
        ref={ref}
        className={cn(className, showToggle && "cursor-pointer")}
        style={clampStyle}
        onClick={onSummaryClick}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            "mt-1 text-sm text-muted-foreground hover:text-foreground",
            "underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          )}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
