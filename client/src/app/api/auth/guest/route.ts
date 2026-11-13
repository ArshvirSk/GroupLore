import { apiError } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return apiError(
    410,
    "guest_endpoint_removed",
    "Use Supabase anonymous sign-in for guest play.",
  );
}
