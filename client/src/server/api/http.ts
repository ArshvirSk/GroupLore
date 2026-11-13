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
