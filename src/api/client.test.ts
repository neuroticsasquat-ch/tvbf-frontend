import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { ApiError, apiFetch, buildShowsQuery, setCsrfToken } from "./client";
import type { ShowFilters } from "./types";

describe("apiFetch", () => {
  afterEach(() => server.resetHandlers());

  it("returns parsed JSON on 2xx", async () => {
    server.use(http.get(`${env.apiBaseUrl}/ping`, () => HttpResponse.json({ ok: true })));
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
    server.use(http.get(`${env.apiBaseUrl}/fail`, () => new HttpResponse(null, { status: 500 })));
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
      status: "Returning Series",
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
    expect(q.get("status")).toBe("Returning Series");
    expect(q.getAll("genre")).toEqual(["Drama", "Comedy"]);
    expect(q.getAll("network")).toEqual(["10", "11"]);
    expect(q.get("language")).toBe("English");
    expect(q.get("type")).toBe("Scripted");
    expect(q.get("sort")).toBe("-premiered");
    expect(q.get("page")).toBe("2");
    expect(q.get("per_page")).toBe("25");
  });
});

describe("apiFetch — auth + csrf", () => {
  beforeEach(() => {
    setCsrfToken(null);
  });

  it("includes credentials on every request", async () => {
    let observedCredentials: RequestCredentials | undefined;
    server.use(
      http.get(`${env.apiBaseUrl}/probe`, ({ request }) => {
        observedCredentials = request.credentials;
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch("/probe");
    expect(observedCredentials).toBe("include");
  });

  it("attaches X-CSRF-Token from in-memory csrf token on POST", async () => {
    setCsrfToken("abc123");
    let observedHeader: string | null = null;
    server.use(
      http.post(`${env.apiBaseUrl}/echo`, ({ request }) => {
        observedHeader = request.headers.get("X-CSRF-Token");
        return HttpResponse.json({});
      }),
    );
    await apiFetch("/echo", { method: "POST", body: "{}" });
    expect(observedHeader).toBe("abc123");
  });

  it("does not attach X-CSRF-Token when token is unset", async () => {
    let observedHeader: string | null = "sentinel";
    server.use(
      http.post(`${env.apiBaseUrl}/echo`, ({ request }) => {
        observedHeader = request.headers.get("X-CSRF-Token");
        return HttpResponse.json({});
      }),
    );
    await apiFetch("/echo", { method: "POST", body: "{}" });
    expect(observedHeader).toBeNull();
  });

  it("returns undefined for 204", async () => {
    server.use(
      http.delete(`${env.apiBaseUrl}/gone`, () => new HttpResponse(null, { status: 204 })),
    );
    const result = await apiFetch<void>("/gone", { method: "DELETE" });
    expect(result).toBeUndefined();
  });
});

describe("apiFetch — field validation errors", () => {
  afterEach(() => server.resetHandlers());

  function respond(body: Record<string, unknown>, status = 422) {
    server.use(http.post(`${env.apiBaseUrl}/signup`, () => HttpResponse.json(body, { status })));
  }

  async function reject(): Promise<ApiError> {
    try {
      await apiFetch("/signup", { method: "POST", body: "{}" });
    } catch (e) {
      return e as ApiError;
    }
    throw new Error("expected apiFetch to reject");
  }

  it("indexes FastAPI's per-field messages by field name", async () => {
    respond({
      detail: [
        {
          type: "value_error",
          loc: ["body", "display_name"],
          msg: "Value error, display_name must not be an email address",
          input: "a@b.c",
        },
      ],
    });
    const err = await reject();
    expect(err.fieldErrors).toEqual({
      display_name: "display_name must not be an email address",
    });
  });

  it("uses the first field message as the error message", async () => {
    respond({
      detail: [
        { type: "missing", loc: ["body", "email"], msg: "Field required" },
        { type: "missing", loc: ["body", "password"], msg: "Field required" },
      ],
    });
    const err = await reject();
    expect(err.message).toBe("Field required");
    expect(err.fieldErrors).toEqual({ email: "Field required", password: "Field required" });
  });

  it("keeps the first message when one field errors twice", async () => {
    respond({
      detail: [
        { type: "value_error", loc: ["body", "display_name"], msg: "Value error, first" },
        { type: "string_too_long", loc: ["body", "display_name"], msg: "second" },
      ],
    });
    const err = await reject();
    expect(err.fieldErrors).toEqual({ display_name: "first" });
  });

  it("joins nested locations and keeps non-body locations addressable", async () => {
    respond({
      detail: [
        { type: "int_parsing", loc: ["query", "page"], msg: "Input should be a valid integer" },
        { type: "missing", loc: ["body", "items", 0, "name"], msg: "Field required" },
        { type: "json_invalid", loc: ["body"], msg: "JSON decode error" },
      ],
    });
    const err = await reject();
    expect(err.fieldErrors).toEqual({
      page: "Input should be a valid integer",
      "items.0.name": "Field required",
      body: "JSON decode error",
    });
  });

  it("leaves a string detail rendering exactly as it does today", async () => {
    respond({ detail: "Invite code is invalid." });
    const err = await reject();
    expect(err.message).toBe("Invite code is invalid.");
    expect(err.fieldErrors).toBeUndefined();
  });

  it("falls back to the generic message when the list holds no usable entries", async () => {
    respond({ detail: [{ nope: true }, "not an object", null] });
    const err = await reject();
    expect(err.message).toBe("Request failed with status 422");
    expect(err.fieldErrors).toBeUndefined();
  });

  it("falls back to the generic message when detail is neither shape", async () => {
    respond({ detail: { display_name: "bad" } });
    const err = await reject();
    expect(err.message).toBe("Request failed with status 422");
    expect(err.fieldErrors).toBeUndefined();
  });
});
