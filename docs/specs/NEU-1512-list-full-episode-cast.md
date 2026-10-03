# NEU-1512 — List full episode cast (SPA half)

**Ticket:** [NEU-1512](https://linear.app/neuroticsasquatch/issue/NEU-1512/list-full-episode-cast)
**Repo:** `tvbf-frontend` — branch `tom/neu-1512-list-full-episode-cast` from `main`
**Project:** tvbf: Maintenance
**Spec:** `tvbf-backend/docs/specs/NEU-1512-list-full-episode-cast.md` — this file is a pointer, not a second spec
**Status:** approved for implementation. This is PR 3 of 3; it ships after the backend's ingest (PR 1), the production backfill, and the routes (PR 2).

The spec is a cross-repo contract and therefore lives in `tvbf-backend/docs/specs/`
(this repo's CLAUDE.md rule). Read it in full. The SPA work is its **§5**, the
acceptance criteria for this repo are **§7.3**, and the routes it consumes are
**§4**.

In one paragraph: the backend ingests TMDB's per-season regular cast, which is
the only place upstream records who a show's regulars are, and rebuilds its
credit routes on it — `/shows/{id}/cast` narrows to regulars with episode
counts, `/shows/{id}/guest-cast` and `/shows/{id}/episode-crew`
are new, season routes `/shows/{id}/seasons/{n}/cast|crew` are new, episode
routes are unchanged, and the person `cast` list becomes one entry per show
with the seasons the person was a regular in. The SPA gives the show page
Cast / Guest stars / Crew / Episode crew tabs with paged lists, the season page
(`/shows/:id/episodes?season=N`) an Episodes / Cast / Crew strip, the episode
page a link to the season's regular cast above its guest cast, and the person
page two tabs with one card per show, newest credited date first, expandable
into season and episode rows. Glossary: `tvbf-backend/CONTEXT.md` — *Regular
credit*, *Series crew credit*, *Season cast*, *Credit group*.
