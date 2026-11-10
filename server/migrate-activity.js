import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ref = url.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];

const sb = createClient(url, key);

// Read the full migration SQL
const sqlFile = readFileSync(
    join(__dirname, "..", "supabase-migration-activity-log.sql"),
    "utf-8",
);

console.log("🔄 Running migration via Supabase Management API...");
console.log(`   Project ref: ${ref}`);

// Try Management API (requires access token or service role)
const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ query: sqlFile }),
    },
);

if (mgmtRes.ok) {
    console.log("✅ Migration succeeded via Management API!");
} else {
    const errText = await mgmtRes.text();
    console.log(`⚠️  Management API returned ${mgmtRes.status}: ${errText}`);
    console.log("   Trying individual statements via PostgREST...");

    // Fallback: try creating an exec_sql function first, then use it
    // This won't work for DDL but let's try the rpc approach
    const statements = sqlFile
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const sql of statements) {
        const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: key,
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({ query: sql }),
        });
        if (!res.ok) {
            console.log(`   Statement failed (${res.status})`);
            break;
        }
    }
}

// Verify
const r1 = await sb.from("activity_log").select("id").limit(0);
const r2 = await sb.from("player_stats").select("id").limit(0);
console.log("\n── Verification ──");
console.log("activity_log:", r1.error ? `MISSING` : "✅ OK");
console.log("player_stats:", r2.error ? `MISSING` : "✅ OK");

if (r1.error || r2.error) {
    console.log("\n╔══════════════════════════════════════════════════════╗");
    console.log("║  Tables not created automatically.                   ║");
    console.log("║  Please run the migration manually:                  ║");
    console.log("║                                                      ║");
    console.log("║  1. Open https://supabase.com/dashboard              ║");
    console.log("║  2. Go to SQL Editor                                 ║");
    console.log("║  3. Paste contents of:                               ║");
    console.log("║     supabase-migration-activity-log.sql              ║");
    console.log("║  4. Click 'Run'                                      ║");
    console.log("╚══════════════════════════════════════════════════════╝");
}

process.exit(0);
