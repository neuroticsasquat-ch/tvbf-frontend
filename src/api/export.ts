import { env } from "@/env";
import { ApiError } from "./client";

const DEFAULT_FILENAME_RE = /filename="([^"]+)"/;

/** Streams `GET /me/export` and triggers a browser download. Uses raw `fetch`
 * rather than `apiFetch` because we need the Blob + `Content-Disposition`
 * header, not a JSON parse.
 */
export async function downloadMyData(): Promise<void> {
  const res = await fetch(`${env.apiBaseUrl}/me/export`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `Export failed with status ${res.status}`, null);
  }
  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get("content-disposition"),
  );

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // Some browsers require the anchor to be in the document to honor `download`.
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function filenameFromContentDisposition(header: string | null): string {
  const fallback = `tvbf-export-${new Date().toISOString().slice(0, 10)}.json`;
  if (!header) return fallback;
  const match = DEFAULT_FILENAME_RE.exec(header);
  return match?.[1] ?? fallback;
}
