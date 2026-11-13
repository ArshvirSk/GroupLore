import { apiJson } from "@/server/api/http";
import { guestsAllowed } from "@/server/lib/guestAccess.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return apiJson({ guestsEnabled: guestsAllowed() });
}
