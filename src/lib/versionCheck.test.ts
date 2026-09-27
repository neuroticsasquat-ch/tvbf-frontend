import { describe, expect, it } from "vitest";
import { RELOAD_AFTER_HIDDEN_MS, decideVersionAction, parseDeployedVersion } from "./versionCheck";

describe("decideVersionAction", () => {
  const base = { current: "abc", deployed: "def", hiddenMs: 0, promptedVersion: null };

  it("does nothing when the versions match", () => {
    expect(decideVersionAction({ ...base, deployed: "abc" })).toBe("nothing");
    expect(
      decideVersionAction({ ...base, deployed: "abc", hiddenMs: RELOAD_AFTER_HIDDEN_MS * 10 }),
    ).toBe("nothing");
  });

  it("reloads when they differ and the page was hidden for at least the threshold", () => {
    expect(decideVersionAction({ ...base, hiddenMs: RELOAD_AFTER_HIDDEN_MS })).toBe("reload");
    expect(
      decideVersionAction({ ...base, hiddenMs: RELOAD_AFTER_HIDDEN_MS + 1, promptedVersion: "def" }),
    ).toBe("reload");
  });

  it("prompts when they differ, the page was hidden briefly, and this version was not yet offered", () => {
    expect(decideVersionAction({ ...base, hiddenMs: RELOAD_AFTER_HIDDEN_MS - 1 })).toBe("prompt");
    expect(decideVersionAction({ ...base, promptedVersion: "older" })).toBe("prompt");
  });

  it("does nothing when the user was already prompted for that version", () => {
    expect(decideVersionAction({ ...base, promptedVersion: "def" })).toBe("nothing");
  });
});

describe("parseDeployedVersion", () => {
  it("reads the version id", () => {
    expect(parseDeployedVersion({ version: "def" })).toBe("def");
  });

  it("rejects anything that is not the expected shape", () => {
    expect(parseDeployedVersion(null)).toBeNull();
    expect(parseDeployedVersion("<!doctype html>")).toBeNull();
    expect(parseDeployedVersion({})).toBeNull();
    expect(parseDeployedVersion({ version: "" })).toBeNull();
    expect(parseDeployedVersion({ version: 42 })).toBeNull();
  });
});
