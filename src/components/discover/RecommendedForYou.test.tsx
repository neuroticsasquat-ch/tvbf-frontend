import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { useRemoveShow } from "@/api/me";
import type { Recommendation } from "@/api/types";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RecommendedForYou } from "./RecommendedForYou";

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 1,
    name: "Severance",
    type: null,
    status: null,
    language: null,
    premiered: "2022-02-18",
    ended: null,
    image_medium: null,
    image_original: null,
    network: null,
    web_channel: null,
    genres: [],
    matched_aka: null,
    rating_average: null,
    my_rating: null,
    rank: 1,
    ...overrides,
  };
}

/** Serve a list that shrinks as the viewer acts on it, exactly as the server
 * does: `GET /me/recommendations` suppresses a stored suggestion once the
 * viewer has a record for that show (NEU-1175), and the next stored one takes
 * its place. `calls` reports how many requests have been answered. */
function serveShrinkingList(pages: Recommendation[][]) {
  let call = 0;
  server.use(
    http.get(`${env.apiBaseUrl}/me/recommendations`, () => {
      const recommendations = pages[Math.min(call, pages.length - 1)];
      call += 1;
      return HttpResponse.json({ recommendations });
    }),
    http.put(`${env.apiBaseUrl}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
    http.delete(`${env.apiBaseUrl}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
  );
  return { calls: () => call };
}

/** A My Shows removal taken somewhere other than the grid — the show detail
 * page in the running app. Anything that changes one of project spec §8's four
 * records has to refresh this key, so the trigger is deliberately not one of
 * the grid's own buttons. */
function RemoveElsewhere({ showId }: { showId: number }) {
  const remove = useRemoveShow();
  return <button onClick={() => remove.mutate(showId)}>remove elsewhere</button>;
}

const A = makeRecommendation({ id: 1, name: "Severance", rank: 1 });
const B = makeRecommendation({ id: 2, name: "The Leftovers", rank: 2 });
const C = makeRecommendation({ id: 3, name: "Andor", rank: 3 });

describe("RecommendedForYou", () => {
  it("drops the added card and surfaces the next suggestion, with no reload", async () => {
    // AC 1. The replacement is the server's choice from the stored set, so the
    // refetch is the only correct source — there is nothing to optimistically
    // put in the gap.
    serveShrinkingList([
      [A, B],
      [B, C],
    ]);
    renderWithProviders(<RecommendedForYou />);

    expect(await screen.findByText("Severance")).toBeInTheDocument();
    expect(screen.queryByText("Andor")).not.toBeInTheDocument();

    const cards = screen.getAllByRole("button", { name: "Add to My Shows" });
    await userEvent.click(cards[0]);

    await waitFor(() => expect(screen.queryByText("Severance")).not.toBeInTheDocument());
    expect(screen.getByText("The Leftovers")).toBeInTheDocument();
    expect(screen.getByText("Andor")).toBeInTheDocument();
  });

  it("restores a card when the show leaves My Shows again", async () => {
    // AC 3. Suppression is a live join rather than a stored flag, so removing
    // the show brings the recommendation back — and the same invalidation
    // carries it. The removal happens off this surface, because a suppressed
    // show has no card here to remove it from.
    serveShrinkingList([[B], [A, B]]);
    renderWithProviders(
      <>
        <RecommendedForYou />
        <RemoveElsewhere showId={1} />
      </>,
    );

    expect(await screen.findByText("The Leftovers")).toBeInTheDocument();
    expect(screen.queryByText("Severance")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "remove elsewhere" }));

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
  });

  it("renders a list shorter than twelve with no error and no empty state", async () => {
    // AC 4. Fewer than twelve is a normal answer: the stored set is used up
    // rather than backfilled from an older one.
    serveShrinkingList([[A, B, C]]);
    renderWithProviders(<RecommendedForYou />);

    await screen.findByText("Severance");
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByText(/No shows match your filters/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says one line when the list empties under a viewer who had rows", async () => {
    // AC 5, the warm half. This is not the empty state project spec §11
    // forbids: it is reachable only by a user who just used up every
    // suggestion they were given, and it explains something they spent.
    serveShrinkingList([[A], []]);
    renderWithProviders(<RecommendedForYou />);

    await screen.findByText("Severance");
    await userEvent.click(screen.getByRole("button", { name: "Add to My Shows" }));

    expect(await screen.findByText(/new recommendations on Sunday/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    // Never `ShowGrid`'s filter copy — nothing here was filtered.
    expect(screen.queryByText(/No shows match your filters/i)).not.toBeInTheDocument();
  });

  it("renders nothing at all on a cold empty list", async () => {
    // AC 5, the cold half: never generated, below the floor, a failed Sunday
    // run and a failed request are all this same answer.
    const request = serveShrinkingList([[]]);
    renderWithProviders(<RecommendedForYou />);

    await waitFor(() => expect(request.calls()).toBe(1));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/new recommendations on Sunday/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Recommendations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("leaves the card in place, and shows no error, when the add fails", async () => {
    // AC 9. `useAddShow` has never raised a page-level error and does not
    // start here; the button's own revert is the whole of the feedback.
    server.use(
      http.get(`${env.apiBaseUrl}/me/recommendations`, () =>
        HttpResponse.json({ recommendations: [A] }),
      ),
      http.put(`${env.apiBaseUrl}/me/shows/1`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<RecommendedForYou />);

    await screen.findByText("Severance");
    await userEvent.click(screen.getByRole("button", { name: "Add to My Shows" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add to My Shows" })).toBeInTheDocument(),
    );
    expect(screen.getByText("Severance")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
