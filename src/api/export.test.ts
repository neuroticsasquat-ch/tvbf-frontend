import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { downloadMyData, filenameFromContentDisposition } from "./export";

describe("filenameFromContentDisposition", () => {
  it("extracts the filename from a quoted header", () => {
    expect(
      filenameFromContentDisposition('attachment; filename="tvbf-export-2026-05-13.json"'),
    ).toBe("tvbf-export-2026-05-13.json");
  });

  it("falls back when the header is null", () => {
    expect(filenameFromContentDisposition(null)).toMatch(/^tvbf-export-/);
  });

  it("falls back when the header has no filename param", () => {
    expect(filenameFromContentDisposition("attachment")).toMatch(/^tvbf-export-/);
  });
});

describe("downloadMyData", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    // jsdom doesn't ship URL.createObjectURL by default; stub for the test.
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: vi.fn(() => "blob:mock"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: originalCreate,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: originalRevoke,
    });
  });

  it("fetches /me/export, names the file from Content-Disposition, and clicks an anchor", async () => {
    let requested = false;
    server.use(
      http.get(`${env.apiBaseUrl}/me/export`, () => {
        requested = true;
        return new HttpResponse('{"account":{}}', {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-disposition": 'attachment; filename="tvbf-export-2026-05-13.json"',
          },
        });
      }),
    );

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadMyData();

    expect(requested).toBe(true);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("throws when the request fails", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me/export`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    await expect(downloadMyData()).rejects.toThrow(/Export failed with status 500/);
  });
});
