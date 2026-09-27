/** A human label for a push subscription's `user_agent`, for the Settings
 * device list (push-notifications project spec §6.3): "iPhone · Safari",
 * "Windows · Chrome". Either half may be missing, and a user agent that says
 * nothing recognisable — or none at all, since the column is nullable
 * (§4.2) — reads "Unknown device".
 *
 * Order matters within each list: Edge and Opera also claim Chrome, Chrome
 * also claims Safari and WebKit, and Android also claims Linux. */
const PLATFORMS: [RegExp, string][] = [
  [/iPhone|iPod/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/Linux/, "Linux"],
];

const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
  // A Home Screen web app on iOS — the only place iOS can subscribe — drops
  // the `Safari/` token, leaving bare WebKit.
  [/AppleWebKit\//, "Safari"],
];

function firstMatch(ua: string, table: [RegExp, string][]): string | null {
  return table.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
}

export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const parts = [firstMatch(ua, PLATFORMS), firstMatch(ua, BROWSERS)].filter(
    (p): p is string => p !== null,
  );
  return parts.length > 0 ? parts.join(" · ") : "Unknown device";
}
