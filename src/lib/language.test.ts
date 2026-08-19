import { describe, expect, it } from "vitest";

import { languageName } from "./language";

describe("languageName", () => {
  it("maps an ISO 639-1 code to its English name", () => {
    expect(languageName("en")).toBe("English");
    expect(languageName("ru")).toBe("Russian");
    expect(languageName("ko")).toBe("Korean");
  });

  it("names the language in English whatever the runner's locale", () => {
    // Pinned to "en" deliberately (§3.2): the rest of the app is English, so
    // "Coreano" beside it is worse than `ko`.
    expect(languageName("es")).toBe("Spanish");
  });

  it("answers null for a code with no display name", () => {
    // TMDB's non-standard `cn` for Cantonese is the known one. Under
    // `Intl.DisplayNames`' default fallback this hands the code straight back,
    // which is the raw string AC 6 forbids.
    expect(languageName("cn")).toBeNull();
    expect(languageName("xx")).toBeNull();
  });

  it("answers null for a structurally invalid code rather than throwing", () => {
    expect(languageName("not a language")).toBeNull();
    expect(languageName("")).toBeNull();
  });

  it("answers null for an absent language", () => {
    expect(languageName(null)).toBeNull();
    expect(languageName(undefined)).toBeNull();
  });
});
