import { apiJson } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const engine = (globalThis as typeof globalThis & {
    __grouploreEngine?: { rooms?: Map<string, unknown> };
  }).__grouploreEngine;

  return apiJson({
    status: "ok",
    timestamp: new Date().toISOString(),
    engine: { rooms: engine?.rooms?.size || 0 },
    guests:
      process.env.ALLOW_GUESTS === "true" ||
      (process.env.NODE_ENV !== "production" &&
        process.env.ALLOW_GUESTS !== "false"),
  });
}
