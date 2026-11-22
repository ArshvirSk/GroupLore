/**
 * Realtime rooms, timers and SSE connections live in this process, so the app
 * needs one always-on Node server (see docs/DEPLOYMENT.md).
 *
 * A serverless host cannot hold the event stream open, and it does not route a
 * later POST back to the instance that owns the connection. The action then
 * fails with `connection_not_found`, the client aborts the stream, and players
 * see "Connection lost — reconnecting" in a loop. Detect that host up front so
 * the failure is a clear message instead of an endless reconnect.
 */
export function serverlessHostDetected(env = process.env) {
  if (env.GROUPLORE_ALLOW_SERVERLESS === "true") return false;
  return Boolean(env.VERCEL);
}

export const SERVERLESS_HOST_CODE = "realtime_requires_persistent_host";

export const SERVERLESS_HOST_MESSAGE =
  "Live play needs one always-on server, and this deployment is serverless. Rooms, timers and the event stream cannot survive here — see docs/DEPLOYMENT.md.";
