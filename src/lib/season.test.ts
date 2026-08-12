import { describe, expect, it } from "vitest";
import { seasonLabel } from "./season";

describe("seasonLabel", () => {
  it("uses the server-supplied name", () => {
    // The whole point of NEU-1129: TMDB names season 0 "Specials", and
    // `catalog.season.name` carries it for 12,633 of 12,638 season-0 rows.
    expect(seasonLabel({ number: 0, name: "Specials" })).toBe("Specials");
  });

  it("falls back to the number when there is no name", () => {
    // The other 5 season-0 rows, and any season upstream never named.
    expect(seasonLabel({ number: 0, name: null })).toBe("Season 0");
    expect(seasonLabel({ number: 3, name: null })).toBe("Season 3");
    expect(seasonLabel({ number: 3 })).toBe("Season 3");
  });

  it("treats a blank or whitespace-only name as absent", () => {
    expect(seasonLabel({ number: 2, name: "" })).toBe("Season 2");
    expect(seasonLabel({ number: 2, name: "   " })).toBe("Season 2");
  });

  it("shows a named regular season by its name", () => {
    // Deliberate: the number is dropped rather than prefixed. A season the
    // upstream bothered to name is better described by that name, and this is
    // what the ticket buys "for free" alongside the specials case.
    expect(seasonLabel({ number: 4, name: "The Final Season" })).toBe("The Final Season");
  });

  it("passes TMDB's default names through unchanged", () => {
    // TMDB names most seasons "Season N", so the overwhelmingly common case
    // renders exactly as it did before this helper existed.
    expect(seasonLabel({ number: 1, name: "Season 1" })).toBe("Season 1");
  });

  it("trims surrounding whitespace off a real name", () => {
    expect(seasonLabel({ number: 0, name: "  Specials  " })).toBe("Specials");
  });

  it("does not infer the specials label from the number", () => {
    // The special case is upstream's to state, not ours to guess — a season 0
    // upstream left unnamed stays "Season 0" rather than becoming "Specials".
    expect(seasonLabel({ number: 0, name: null })).not.toBe("Specials");
  });
});
