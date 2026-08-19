import { describe, expect, it } from "vitest";

import { activeEmptyMessage, watchedEmptyMessage } from "./emptyStates";
import { SELF, type ViewerContext } from "./viewerContext";

const JEANNE: ViewerContext = { kind: "friend", name: "Jeanne" };

describe("activeEmptyMessage", () => {
  it("distinguishes an empty library from a filtered-out one", () => {
    expect(activeEmptyMessage(SELF, true)).toBe("You're not tracking any shows yet.");
    expect(activeEmptyMessage(SELF, false)).toBe("No shows match the current filters.");
  });

  it("names the friend for the library sentence and no other", () => {
    // The filters are the viewer's own in both modes, so that sentence claims
    // nothing about whose library it is (§2.3).
    expect(activeEmptyMessage(JEANNE, true)).toBe("Jeanne isn't tracking any shows.");
    expect(activeEmptyMessage(JEANNE, false)).toBe("No shows match the current filters.");
  });
});

describe("watchedEmptyMessage", () => {
  it("distinguishes an empty history from a filtered-out one", () => {
    expect(watchedEmptyMessage(SELF, true)).toBe("No watch history yet.");
    expect(watchedEmptyMessage(SELF, false)).toBe("No matches in your watch history.");
  });

  it("names the friend in both sentences", () => {
    // Both of these claim something about whose history it is — "your watch
    // history" is a false statement on a friend's page.
    expect(watchedEmptyMessage(JEANNE, true)).toBe("Jeanne has no watch history yet.");
    expect(watchedEmptyMessage(JEANNE, false)).toBe("No matches in Jeanne's watch history.");
  });
});
