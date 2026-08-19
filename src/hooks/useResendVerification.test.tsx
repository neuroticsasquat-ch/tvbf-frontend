import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { useResendVerification } from "./useResendVerification";

describe("useResendVerification", () => {
  it("reports `sent` when the route answers 202", async () => {
    const { result } = renderHook(() => useResendVerification());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.resend();
    });

    await waitFor(() => expect(result.current.status).toBe("sent"));
  });

  it("reports `rate_limited` on the route's 429, not a generic failure", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/me/email/verification`, () =>
        HttpResponse.json({ detail: "rate_limited" }, { status: 429 }),
      ),
    );
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend();
    });

    await waitFor(() => expect(result.current.status).toBe("rate_limited"));
  });

  it("reports `error` for any other failure", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/me/email/verification`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend();
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});
