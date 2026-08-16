import { HttpResponse, http } from "msw";
import { env } from "@/env";
import {
  fixtureCast,
  fixtureCrew,
  fixtureEpisodeCrew,
  fixtureEpisodes,
  fixtureGenres,
  fixtureGuestCast,
  fixtureNetworks,
  fixturePerson,
  fixturePersonCredits,
  fixturePersonListPage,
  fixtureSeason2Episodes,
  fixtureShow,
  fixtureShowListPage,
} from "./fixtures";

const base = env.apiBaseUrl;

export const handlers = [
  // Default: unauthenticated — individual tests can override with server.use(...)
  http.get(`${base}/me`, () => HttpResponse.json({ detail: "auth_required" }, { status: 401 })),
  http.get(`${base}/me/shows`, () => HttpResponse.json([])),
  http.get(`${base}/me/watched`, () => HttpResponse.json([])),
  http.get(`${base}/me/watch-next`, () => HttpResponse.json([])),
  http.get(`${base}/me/upcoming`, () => HttpResponse.json([])),
  http.get(`${base}/me/sessions`, () => HttpResponse.json([])),
  // Empty is the common case and is a 200 with an empty list, never a 204 —
  // the section distinguishes "nothing to show" from "the request failed" by
  // status code (NEU-1112 contract §3).
  http.get(`${base}/me/recommendations`, () => HttpResponse.json({ recommendations: [] })),
  http.get(`${base}/genres`, () => HttpResponse.json(fixtureGenres)),
  http.get(`${base}/networks`, () => HttpResponse.json(fixtureNetworks)),
  http.get(`${base}/shows`, () => HttpResponse.json(fixtureShowListPage)),
  http.get(`${base}/shows/100`, () => HttpResponse.json(fixtureShow)),
  http.get(`${base}/shows/:id`, () =>
    HttpResponse.json({ detail: "show not found" }, { status: 404 }),
  ),
  http.get(`${base}/shows/100/cast`, () => HttpResponse.json(fixtureCast)),
  http.get(`${base}/shows/100/crew`, () => HttpResponse.json(fixtureCrew)),
  // Every other show has no credits — the empty case is 27% of the catalog.
  http.get(`${base}/shows/:id/cast`, () => HttpResponse.json([])),
  http.get(`${base}/shows/:id/crew`, () => HttpResponse.json([])),
  http.get(`${base}/episodes/5000/guest-cast`, () => HttpResponse.json(fixtureGuestCast)),
  // Every other episode has no guest cast — that is 96% of the catalog.
  http.get(`${base}/episodes/:id/guest-cast`, () => HttpResponse.json([])),
  http.get(`${base}/episodes/5000/crew`, () => HttpResponse.json(fixtureEpisodeCrew)),
  // Every other episode has no crew — 22.5% of episodes land here.
  http.get(`${base}/episodes/:id/crew`, () => HttpResponse.json([])),
  http.get(`${base}/people`, () => HttpResponse.json(fixturePersonListPage)),
  http.get(`${base}/people/300`, () => HttpResponse.json(fixturePerson)),
  http.get(`${base}/people/300/credits`, () => HttpResponse.json(fixturePersonCredits)),
  // Every other person has no credits — plenty in the mirror have none at all.
  http.get(`${base}/people/:id/credits`, () =>
    HttpResponse.json({ cast: [], crew: [], guest_cast: [], episode_crew: [] }),
  ),
  http.get(`${base}/people/:id`, () =>
    HttpResponse.json({ detail: "person not found" }, { status: 404 }),
  ),
  http.get(`${base}/shows/100/episodes`, ({ request }) => {
    const url = new URL(request.url);
    const season = url.searchParams.get("season");
    if (season === "2") return HttpResponse.json(fixtureSeason2Episodes);
    return HttpResponse.json(fixtureEpisodes);
  }),
  http.put(`${base}/me/shows/:id/rating`, async ({ params, request }) => {
    const body = (await request.json()) as { stars: number };
    return HttpResponse.json({
      show_id: Number(params.id),
      stars: body.stars,
      rated_at: "2026-05-14T12:00:00Z",
    });
  }),
  http.delete(`${base}/me/shows/:id/rating`, () => new HttpResponse(null, { status: 204 })),
  http.put(`${base}/me/episodes/:id/rating`, async ({ params, request }) => {
    const body = (await request.json()) as { stars: number };
    return HttpResponse.json({
      episode_id: Number(params.id),
      stars: body.stars,
      rated_at: "2026-05-14T12:00:00Z",
    });
  }),
  http.delete(`${base}/me/episodes/:id/rating`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${base}/shows/:id/friends/ratings`, () =>
    HttpResponse.json({ avg: null, count: 0, items: [] }),
  ),
  http.get(`${base}/episodes/:id/friends/ratings`, () =>
    HttpResponse.json({ avg: null, count: 0, items: [] }),
  ),
  http.post(`${base}/me/feedback`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      subject?: string;
      body?: string;
    };
    if (!body.subject || !body.body) {
      return HttpResponse.json({ detail: "Validation error" }, { status: 422 });
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
