import "server-only";
import { NextResponse } from "next/server";

export class ApiFailure extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiFailure";
    this.status = status;
    this.code = code;
  }
}

export const MAX_JSON_BODY_BYTES = 64 * 1024;

/** Read a JSON body with the same 64 KB ceiling as the retired Express app. */
export async function readJson(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw new ApiFailure(
      413,
      "payload_too_large",
      "Request body is too large",
    );
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BODY_BYTES) {
    throw new ApiFailure(
      413,
      "payload_too_large",
      "Request body is too large",
    );
  }
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function apiJson(data: unknown, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function handleApi(
  fn: () => Promise<NextResponse>,
  fallbackMessage = "Something went wrong",
) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiFailure) {
      return apiError(error.status, error.code, error.message);
    }
    console.error("[api]", error);
    return apiError(500, "server_error", fallbackMessage);
  }
}
