import manifestSource from "../public/manifest.webmanifest?raw";
import indexHtml from "../index.html?raw";

// Installability is static files, not code (NEU-1482): this pins the manifest
// against project spec §6.1 and checks every icon it names is a PNG of the size
// it claims, so regenerating icons or editing the manifest cannot drift apart.
// Everything is read through Vite imports — src has no Node types.

type Icon = { src: string; sizes: string; type: string; purpose: string };

const manifest = JSON.parse(manifestSource) as { icons: Icon[] } & Record<string, unknown>;

// Base64 data URLs keyed by "/<file>.png".
const pngs = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../public/*.png", {
      query: "?inline",
      import: "default",
      eager: true,
    }),
  ).map(([file, url]) => [file.replace("../public", ""), url]),
);

function pngSize(src: string): string {
  const url = pngs[src];
  expect(url, `${src} exists`).toBeDefined();
  expect(url.startsWith("data:image/png;base64,")).toBe(true);
  const bytes = Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  // IHDR: width and height are the first two fields after the 16-byte header.
  return `${view.getUint32(16)}x${view.getUint32(20)}`;
}

describe("web manifest", () => {
  it("carries the spec's identity and colours", () => {
    expect(manifest).toMatchObject({
      name: "TV BingeFriend",
      short_name: "BingeFriend",
      start_url: "/",
      display: "standalone",
      background_color: "#0f1729",
      theme_color: "#0f1729",
    });
  });

  it("offers 192 and 512 icons in both any and maskable purposes", () => {
    const pairs = manifest.icons.map((i) => `${i.purpose} ${i.sizes}`).sort();
    expect(pairs).toEqual(["any 192x192", "any 512x512", "maskable 192x192", "maskable 512x512"]);
  });

  it.each(manifest.icons.map((i) => [i.src, i] as const))(
    "%s is a PNG of its declared size",
    (_, icon) => {
      expect(icon.type).toBe("image/png");
      expect(pngSize(icon.src)).toBe(icon.sizes);
    },
  );

  it("has a 180px apple-touch-icon", () => {
    expect(pngSize("/apple-touch-icon.png")).toBe("180x180");
  });
});

describe("index.html", () => {
  const doc = new DOMParser().parseFromString(indexHtml, "text/html");
  const attr = (selector: string, name: string) => doc.querySelector(selector)?.getAttribute(name);

  it("links the manifest and the apple-touch-icon", () => {
    expect(attr('link[rel="manifest"]', "href")).toBe("/manifest.webmanifest");
    expect(attr('link[rel="apple-touch-icon"]', "href")).toBe("/apple-touch-icon.png");
  });

  // The standard pair (NEU-1509 §3.4): browsers that take SVG icons prefer the
  // tile's SVG, the rest fall back to the .ico rather than to nothing.
  it("links the .ico favicon at 32px and keeps the SVG favicon", () => {
    expect(attr('link[rel="icon"][href="/favicon.ico"]', "sizes")).toBe("32x32");
    expect(attr('link[rel="icon"][href="/favicon.svg"]', "type")).toBe("image/svg+xml");
  });

  it("declares the iOS standalone metas and keeps theme-color", () => {
    expect(attr('meta[name="apple-mobile-web-app-capable"]', "content")).toBe("yes");
    expect(attr('meta[name="apple-mobile-web-app-status-bar-style"]', "content")).toBe(
      "black-translucent",
    );
    expect(attr('meta[name="apple-mobile-web-app-title"]', "content")).toBe("BingeFriend");
    expect(attr('meta[name="theme-color"]', "content")).toBe("#0f1729");
  });
});
