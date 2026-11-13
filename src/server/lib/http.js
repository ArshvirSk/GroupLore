/**
 * Consistent API error shape: { error: { code, message } }.
 */
export function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export function unauthorized(res, message = "Sign in to play") {
  return fail(res, 401, "unauthorized", message);
}

export function forbidden(res, message = "You cannot do that") {
  return fail(res, 403, "forbidden", message);
}

export function notFound(res, message = "Not found") {
  return fail(res, 404, "not_found", message);
}

export function conflict(res, code, message) {
  return fail(res, 409, code, message);
}

export function badRequest(res, message, code = "bad_request") {
  return fail(res, 400, code, message);
}

export function serverError(res, message = "Something went wrong") {
  return fail(res, 500, "server_error", message);
}
