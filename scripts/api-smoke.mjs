const base = process.env.API_BASE || "http://localhost:3000";
const token = process.env.TEST_ACCESS_TOKEN || "";

const cases = [
  { path: "/api/health", status: 200 },
  { path: "/api/auth/config", status: 200 },
  {
    path: "/api/auth/guest",
    method: "POST",
    status: 410,
    code: "guest_endpoint_removed",
  },
  { path: "/api/games/catalog", status: 401, code: "unauthorized" },
  { path: "/api/groups", status: 401, code: "unauthorized" },
  { path: "/api/invites/BAD", status: 400, code: "invalid_code" },
  { path: "/api/lobbies/BAD", status: 401, code: "unauthorized" },
];

if (token) {
  cases.push(
    { path: "/api/users/me", status: 200, auth: true },
    { path: "/api/games/catalog", status: 200, auth: true },
    { path: "/api/lobbies/BAD", status: 400, code: "invalid_code", auth: true },
    { path: "/api/groups", status: 200, auth: true },
    { path: "/api/feed?limit=1", status: 200, auth: true },
  );
}

let failed = 0;

for (const test of cases) {
  const response = await fetch(`${base}${test.path}`, {
    method: test.method || "GET",
    headers: test.auth ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = await response.json().catch(() => null);
  const code = body?.error?.code;
  const ok = response.status === test.status && (!test.code || code === test.code);
  console.log(
    `${ok ? "PASS" : "FAIL"} ${test.method || "GET"} ${test.path} -> ${response.status}${
      code ? ` (${code})` : ""
    }`,
  );
  if (!ok) {
    failed += 1;
    console.log(`  expected ${test.status}${test.code ? ` / ${test.code}` : ""}`);
  }
}

if (!token) {
  console.log("Authenticated cases skipped; set TEST_ACCESS_TOKEN to include them.");
}

if (failed > 0) process.exitCode = 1;
