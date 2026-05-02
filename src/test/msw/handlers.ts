import { HttpResponse, http } from "msw";
import { env } from "@/env";
import {
  fixtureEpisodes,
  fixtureGenres,
  fixtureNetworks,
  fixtureSeason2Episodes,
  fixtureShow,
  fixtureShowListPage,
} from "./fixtures";

const base = env.apiBaseUrl;

export const handlers = [
  // Default: unauthenticated — individual tests can override with server.use(...)
  http.get(`${base}/me`, () => HttpResponse.json({ detail: "auth_required" }, { status: 401 })),
  http.get(`${base}/me/shows`, () => HttpResponse.json([])),
  http.get(`${base}/me/watch-next`, () => HttpResponse.json([])),
  http.get(`${base}/me/upcoming`, () => HttpResponse.json([])),
  http.get(`${base}/genres`, () => HttpResponse.json(fixtureGenres)),
  http.get(`${base}/networks`, () => HttpResponse.json(fixtureNetworks)),
  http.get(`${base}/shows`, () => HttpResponse.json(fixtureShowListPage)),
  http.get(`${base}/shows/100`, () => HttpResponse.json(fixtureShow)),
  http.get(`${base}/shows/:id`, () =>
    HttpResponse.json({ detail: "show not found" }, { status: 404 }),
  ),
  http.get(`${base}/shows/100/episodes`, ({ request }) => {
    const url = new URL(request.url);
    const season = url.searchParams.get("season");
    if (season === "2") return HttpResponse.json(fixtureSeason2Episodes);
    return HttpResponse.json(fixtureEpisodes);
  }),
];
