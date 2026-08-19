# Error reporting

Both halves of the app funnel unexpected errors through a single seam, so an
operator can wire error visibility to any sink without touching call sites and
without adding a vendor SDK.

| Side     | Module                        | Enable by setting                       |
| -------- | ----------------------------- | --------------------------------------- |
| API      | `backend/utils/errorReporter.js`  | `ERROR_WEBHOOK_URL` (runtime env)   |
| Web      | `frontend/src/utils/reportError.js` | `VITE_ERROR_ENDPOINT` (build-time) |

When the variable is unset, nothing is sent — the error is still logged
(structured pino on the server, `console.error` in the browser). That is the
default in development and in the test suite, which pins `ERROR_WEBHOOK_URL`
empty so a failing test can never POST to a real collector.

## What triggers a report

**API** — `middleware/errorHandler.js` reports only **unexpected** failures:

- any response with status **>= 500**
- `unhandledRejection` and `uncaughtException` (level `fatal`, from `server.js`)

Expected 4xx answers — validation failures, 401/403/404 — are *not* incidents
and are never reported. Every report also increments the
`unhandled_errors_total{name="..."}` counter exposed on `GET /api/metrics`.

**Web** — `utils/reportError.js` reports:

- render crashes caught by the `ErrorBoundary` (`source: "render"`)
- `window` `error` events (`source: "window"`)
- unhandled promise rejections (`source: "unhandledrejection"`)

## Payload — API

`POST <ERROR_WEBHOOK_URL>`, `Content-Type: application/json`, fire-and-forget
with a 2 s timeout:

```json
{
  "name": "TypeError",
  "message": "Cannot read properties of undefined (reading 'id')",
  "stack": "TypeError: Cannot read properties of undefined...\n    at getPost (/app/backend/controllers/postController.js:120:31)\n    ...",
  "level": "error",
  "service": "unsent-archives-api",
  "timestamp": "2026-08-19T10:31:07.482Z",
  "context": {
    "route": "/api/posts/:id",
    "method": "GET",
    "statusCode": 500,
    "requestId": "b3f1c0d2-...",
    "userId": "64b000000000000000000001"
  }
}
```

| Field       | Notes                                                                 |
| ----------- | --------------------------------------------------------------------- |
| `level`     | `"error"` for a 5xx, `"fatal"` for a process crash                     |
| `service`   | always `unsent-archives-api`                                          |
| `context.route` | normalised — ids collapse to `:id`, so it groups cleanly          |
| `context.userId` | present only when the request was authenticated                  |

## Payload — Web

`POST <VITE_ERROR_ENDPOINT>` via `navigator.sendBeacon`, falling back to
`fetch(..., { keepalive: true })`:

```json
{
  "name": "TypeError",
  "message": "x.map is not a function",
  "stack": "TypeError: x.map is not a function\n    at NoteCard (...)",
  "app": "unsent-archives-web",
  "url": "https://example.com/posts/64b0000000000000000000a1",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2026-08-19T10:31:07.482Z",
  "context": {
    "source": "render",
    "componentStack": "\n    at NoteCard\n    at ExplorePage ..."
  }
}
```

## Redaction

Both sides drop context entries whose **key name contains** any of:

```
password  token  authorization  jwt  secret  apikey  api_key  cookie
```

Substring matching, case-insensitive, so `passwordHash`, `accessToken`,
`refresh_token`, `Authorization` and `JWT_SECRET` are all removed. The server
additionally redacts `req.headers.authorization` and any `password`/`token`
field from its pino output.

This is enforced by tests, not convention:

- `backend/tests/errorReporter.test.js` — redaction of exact and variant key
  names, no forwarding when the URL is unset, and that a rejected webhook never
  throws into the request path
- `backend/tests/errorHandler.test.js` — the end-to-end path: a request that
  500s produces a sanitised POST with the shape above, a 4xx produces none, and
  a failing webhook does not change the client's response
- `frontend/src/utils/reportError.test.js` — the browser equivalent, including
  the global `error` / `unhandledrejection` handlers

## Wiring it to a real sink

The payload is deliberately plain JSON, so most collectors accept it directly.

**Slack** — create an Incoming Webhook and put a two-line shim in front of it
(Slack expects `{"text": ...}`), or point `ERROR_WEBHOOK_URL` at a Cloud
Function that reformats.

**Sentry** — use the [Store endpoint][sentry-store] or a relay, mapping
`name`/`message`/`stack` onto Sentry's `exception` interface and `context` onto
`tags`/`extra`. Swapping in `@sentry/node` instead is a two-line change inside
`errorReporter.js`: initialise it when a DSN is present and call
`Sentry.captureException(err, { extra: safeContext })` from `captureException`.
Nothing outside that module needs to change — that is the point of the seam.

**Anything else** — an HTTP endpoint that accepts a JSON POST and ignores the
response body is enough.

[sentry-store]: https://develop.sentry.dev/sdk/store/

## Operational checks

- `GET /api/health` — liveness plus the mongoose connection state
- `GET /api/metrics` — Prometheus exposition including
  `unhandled_errors_total`, `http_request_errors_total{status_class="5xx"}` and
  the request-latency histogram

A rising `unhandled_errors_total` with no corresponding webhook traffic means
`ERROR_WEBHOOK_URL` is unset or the sink is rejecting the POST.
