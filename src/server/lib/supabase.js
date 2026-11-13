import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "⚠️  Supabase credentials not found. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env",
  );
}

// A syntactically valid local fallback keeps module imports and unit tests
// working when no live project is configured. Real requests still require the
// env vars above and fail clearly against the fallback.
export const supabase = createClient(
  supabaseUrl || "http://127.0.0.1:54321",
  supabaseServiceKey || "test-service-role-key",
  {
    auth: { persistSession: false },
  },
);
