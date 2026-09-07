import { z } from "zod";
import { env } from "./env";

const errorSchema = z.object({
  error: z.object({
    code: z.string().default("REQUEST_FAILED"),
    message: z.string().default("The request could not be completed."),
    fields: z.record(z.string(), z.array(z.string())).optional(),
    requestId: z.string().optional(),
  }),
});

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | unknown[];
  csrfToken?: string;
  authenticated?: boolean;
};

function isNativeBody(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof Blob
  );
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (options.csrfToken) headers.set("x-csrf-token", options.csrfToken);
  let body = options.body;
  if (body !== undefined && !isNativeBody(body)) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(body);
  }
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    body: body as BodyInit | undefined,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    const parsed = errorSchema.safeParse(
      await response.json().catch(() => null),
    );
    const detail = parsed.success
      ? parsed.data.error
      : {
          code: "REQUEST_FAILED",
          message: `The API returned ${response.status}.`,
        };
    if (response.status === 401 && options.authenticated !== false) {
      window.dispatchEvent(new CustomEvent("br:session-expired"));
    }
    throw new ApiError(
      response.status,
      detail.code,
      detail.message,
      detail.fields,
      detail.requestId,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadProtected(path: string, filename: string) {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    credentials: "include",
  });
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new CustomEvent("br:session-expired"));
    throw new ApiError(
      response.status,
      "DOWNLOAD_FAILED",
      `Download failed with status ${response.status}.`,
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function privateMediaUrl(id: string) {
  return `${env.apiBaseUrl}/admin/media/${encodeURIComponent(id)}/file`;
}

export type PageMeta = { page: number; pageSize: number; total: number };
export type PageResponse<T> = { data: T[]; meta: PageMeta };
export type DataResponse<T> = { data: T };
