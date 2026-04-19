import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { ApiError, apiFetch, buildShowsQuery } from "./client";
import type { ShowFilters } from "./types";

describe("apiFetch", () => {
  afterEach(() => server.resetHandlers());

  it("returns parsed JSON on 2xx", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/ping`, () => HttpResponse.json({ ok: true })),
    );
    const result = await apiFetch<{ ok: boolean }>("/ping");
    expect(result).toEqual({ ok: true });
  });

  it("throws ApiError on non-2xx with detail message", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/fail`, () =>
        HttpResponse.json({ detail: "nope" }, { status: 404 }),
      ),
    );
    await expect(apiFetch("/fail")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "nope",
    });
  });

  it("throws ApiError with generic message when body has no detail", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/fail`, () => new HttpResponse(null, { status: 500 })),
    );
    await expect(apiFetch("/fail")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("buildShowsQuery", () => {
  it("returns empty string when filters are empty", () => {
    expect(buildShowsQuery({})).toBe("");
  });

  it("omits undefined and empty-array values", () => {
    const filters: ShowFilters = {
      search: "",
      genre: [],
      network: [],
      page: 1,
    };
    expect(buildShowsQuery(filters)).toBe("page=1");
  });

  it("serializes scalars, repeats arrays, and keeps sort", () => {
    const filters: ShowFilters = {
      search: "the",
      status: "Running",
      genre: ["Drama", "Comedy"],
      network: [10, 11],
      language: "English",
      type: "Scripted",
      sort: "-premiered",
      page: 2,
      per_page: 25,
    };
    const q = new URLSearchParams(buildShowsQuery(filters));
    expect(q.get("search")).toBe("the");
    expect(q.get("status")).toBe("Running");
    expect(q.getAll("genre")).toEqual(["Drama", "Comedy"]);
    expect(q.getAll("network")).toEqual(["10", "11"]);
    expect(q.get("language")).toBe("English");
    expect(q.get("type")).toBe("Scripted");
    expect(q.get("sort")).toBe("-premiered");
    expect(q.get("page")).toBe("2");
    expect(q.get("per_page")).toBe("25");
  });
});
