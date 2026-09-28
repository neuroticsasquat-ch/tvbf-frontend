import { cn } from "@/lib/cn";

interface Props {
  /** `header` is `AppShell`'s home link; `hero` is `LoginPage`'s hero. */
  size: "header" | "hero";
}

const SIZES = {
  header: { mark: "h-7", wordmark: "text-lg" },
  hero: { mark: "h-10", wordmark: "text-2xl md:text-3xl" },
} as const;

/** The brand's lockup: the mark, then the wordmark (NEU-1509; the terms are
 * `CONTEXT.md` § Brand's).
 *
 * **The only place either is drawn.** The header and the login hero render
 * this and state nothing but `size` — the `ShowPoster` / `UserIdentity`
 * precedent, which exists because two hand-rolled copies of a drawing drift.
 * `size` is a variant, not a `className`: a surface wanting a third size adds
 * it to `SIZES`.
 *
 * **The mark is inlined, and drawn without its tile**, for `SasquatchMark`'s
 * reason: an SVG through `<img src>` cannot inherit `currentColor`, and every
 * amber fill here is `currentColor` under `text-brand`, so the mark and the
 * wordmark's "TV" draw from the one `--color-brand` token. The tile's navy is
 * `#0f1729` against a `#0f172a` header — invisible in place, and it would only
 * shrink the set to ~75 % of its box. The paths are copied verbatim from
 * `public/favicon.svg`'s inner group with its `translate/scale` dropped, and the
 * `viewBox` is their computed bounds (body x 6–154, antenna balls to y 0, feet
 * to y 136); re-copy rather than redraw. The screen's `#1b2a4a` stays a literal
 * — it is the drawing's own colour, and must match the icon files.
 *
 * **The mark is `aria-hidden`**: the wordmark beside it is the name, and its
 * text is exactly `TV BingeFriend`. The heavier weight is a `span`, not the
 * generator's `<b>`, because it is presentational.
 */
export function BrandLockup({ size }: Props) {
  const { mark, wordmark } = SIZES[size];
  return (
    <span data-brand-lockup className="inline-flex items-center gap-2">
      <svg
        aria-hidden
        xmlns="http://www.w3.org/2000/svg"
        viewBox="6 0 148 136"
        className={cn("w-auto shrink-0 text-brand", mark)}
      >
        <g fill="currentColor">
          <path
            d="M80 30 54 8M80 30 108 6"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="54" cy="8" r="6" />
          <circle cx="108" cy="6" r="6" />
          <rect x="30" y="122" width="16" height="14" rx="4" />
          <rect x="114" y="122" width="16" height="14" rx="4" />
          <rect x="6" y="30" width="148" height="96" rx="20" />
        </g>
        <rect x="18" y="42" width="124" height="72" rx="12" fill="#1b2a4a" />
        <path
          fill="currentColor"
          d="M40.02 90V71.06H33.1V66.24H52.83V71.06H45.85V90ZM62.62 90 54.88 66.24H61.21L66.43 85.14H66.94L72.16 66.24H78.42L70.68 90ZM82.41 90V66.24H92.67Q94.9 66.24 96.68 66.62Q98.46 67 99.72 67.77Q100.98 68.54 101.65 69.75Q102.32 70.96 102.32 72.61Q102.32 74.02 101.72 75.06Q101.13 76.1 99.87 76.75Q98.61 77.4 96.52 77.62V78.23Q99.98 78.44 101.63 79.88Q103.29 81.32 103.29 83.77Q103.29 85.86 102.17 87.23Q101.06 88.6 98.9 89.3Q96.74 90 93.57 90ZM87.95 85.39H93.35Q95.55 85.39 96.59 84.76Q97.64 84.13 97.64 82.76Q97.64 81.25 96.38 80.5Q95.12 79.74 92.52 79.74H87.95ZM87.95 76.21H91.73Q94.29 76.21 95.48 75.51Q96.66 74.81 96.66 73.4Q96.66 72.04 95.57 71.41Q94.47 70.78 92.24 70.78H87.95ZM108.32 90V66.24H126.39V71.17H114.12V76.82H125.1V81.54H114.12V90Z"
        />
      </svg>
      <span className={cn("font-brand font-light tracking-[-0.01em]", wordmark)}>
        <span className="font-semibold text-brand">TV</span>{" "}
        <span className="font-semibold">Binge</span>Friend
      </span>
    </span>
  );
}
