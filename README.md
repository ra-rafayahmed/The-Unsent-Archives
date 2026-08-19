# The Unsent Archives

[![CI](https://github.com/ra-rafayahmed/The-Unsent-Archives/actions/workflows/ci.yml/badge.svg)](https://github.com/ra-rafayahmed/The-Unsent-Archives/actions/workflows/ci.yml)

A quiet place for the letters you never sent. Users write styled "notes"
(text, optional image/audio), publish them publicly, to followers, privately, or
anonymously, and browse everyone else's through a feed, search, trending tags,
collections and a personalised recommendation engine. Built as an Advanced
Database Management Systems project around MongoDB: embedded vs referenced
documents, denormalised counters, Mongoose hooks used as write triggers, and a
recommender that keeps per-user affinity profiles.

- **Backend** — Node 22 · Express 5 · Mongoose 9 · JWT auth · Joi validation · pino logging
- **Frontend** — React 19 · Vite · react-router 7 · axios · recharts
- **Tests** — Jest + Supertest + mongodb-memory-server (API) · Vitest + Testing Library (UI)
- **Repo** — npm workspaces monorepo (`backend`, `frontend`) with a single root lockfile

---

## Verification at a glance

Everything below is reproducible with the command next to it — no setup beyond
`npm ci`. Figures are from the latest run on a clean clone.

| Claim                       | Command                     | Result                                             |
| --------------------------- | --------------------------- | -------------------------------------------------- |
| Installs from a clean clone | `npm ci`                    | exit 0, one root lockfile, both workspaces         |
| Test suite runs             | `npm test`                  | **666 tests** pass (231 backend + 435 frontend)    |
| Coverage gates hold         | `npm run test:coverage`     | backend 87% / frontend 88% statements, gated in CI |
| Lint is clean               | `npm run lint`              | 0 errors, 0 warnings                               |
| Types are checked           | `npm run typecheck`         | `tsc --noEmit`, 0 errors                           |
| Formatting is enforced      | `npm run format:check`      | clean across root + both workspaces                |
| Web bundle builds           | `npm run build`             | no chunk over the 500 kB warning threshold         |
| Whole stack boots           | `docker compose up --build` | API answers `GET /api/health` with 200             |

CI (`.github/workflows/ci.yml`) runs every one of these on each push across six
jobs — **Backend**, **Frontend**, **Clean clone**, **Docker**, **Preview** —
including a job that does nothing but `npm ci && npm test` on a runner with no
cache, so the first two rows cannot silently rot.

Deeper evidence lives in:

- [`docs/VALIDATION.md`](docs/VALIDATION.md) — every mutating route mapped to
  its Joi schema, with the five body-less exceptions justified
- [`docs/ERROR-REPORTING.md`](docs/ERROR-REPORTING.md) — the exact payload an
  operator receives, and how to point it at Sentry/Slack
- [`DEPENDENCIES.md`](DEPENDENCIES.md) — direct dependencies per workspace and
  currency
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — coverage baseline and the typecheck ratchet

## Quick start

### Option A — Docker (nothing to install but Docker)

```bash
git clone https://github.com/ra-rafayahmed/The-Unsent-Archives.git
cd The-Unsent-Archives
docker compose up --build
```

| Service | URL                                                         |
| ------- | ----------------------------------------------------------- |
| Web app | http://localhost:8080                                       |
| API     | http://localhost:5000/api/health                            |
| MongoDB | mongodb://localhost:27017 (internal to the compose network) |

Works with no configuration — compose supplies dev defaults and starts its own
MongoDB. To customise (real `JWT_SECRET`, admin emails, different ports, or an
external Atlas database), copy [`.env.example`](.env.example) to `.env` first:

```bash
cp .env.example .env      # then edit JWT_SECRET / ADMIN_EMAILS
docker compose up --build
```

Or open the repo in a **devcontainer** (VS Code / GitHub Codespaces): the
image is Node 22 with Docker-in-Docker, and `npm ci` runs on create.

### Option B — Local Node

Prerequisites: Node **22+** and npm. Nothing else — not even a database, if all
you want is to run the test suite.

```bash
git clone https://github.com/ra-rafayahmed/The-Unsent-Archives.git
cd The-Unsent-Archives
npm ci                       # installs BOTH workspaces (see note below)
```

> **One install, one lockfile.** This is an npm workspaces monorepo, so there
> is a single `package-lock.json` at the root and `npm ci` there installs
> `backend/` and `frontend/` together into a shared `node_modules`. There are
> deliberately no per-package lockfiles — npm ignores them in a workspace and
> they drift. Running `npm ci` from inside `backend/` does the same whole-repo
> install anyway, so there is no reason to install twice.

To run the app you also need a MongoDB (local `mongod`,
`docker run -p 27017:27017 mongo:7`, or an Atlas URI):

```bash
cp backend/.env.example backend/.env   # then edit MONGODB_URI / JWT_SECRET
npm run dev:backend                    # http://localhost:5000  (nodemon)
npm run dev:frontend                   # http://localhost:5173  (new terminal)
```

The frontend talks to `http://localhost:5000/api` by default; set
`VITE_API_BASE_URL` to point elsewhere.

## Running the tests

The suite needs **no database, no services and no credentials**, so this works
on a machine that has never seen the project:

```bash
npm ci && npm test
```

- **backend** — Jest + Supertest against an in-memory MongoDB
  (`mongodb-memory-server` downloads the mongod binary once, ~100 MB, then
  caches it under `.mongodb-binaries/`). `NODE_ENV=test` pins the JWT secret and
  blanks `ERROR_WEBHOOK_URL`, so nothing leaves the process.
- **frontend** — Vitest in jsdom, with `src/api/axios` mocked; no network.

| Command                 | Runs                                   |
| ----------------------- | -------------------------------------- |
| `npm test`              | both suites (666 tests)                |
| `npm run test:backend`  | Jest only                              |
| `npm run test:frontend` | Vitest only                            |
| `npm run test:coverage` | both, failing below the coverage gates |

CI runs this exact two-command path on every push in a job called
**Clean clone**, on a runner with no cache, so the claim above stays true.

---

## Configuration

All backend settings come from environment variables (see
[`backend/.env.example`](backend/.env.example)):

| Variable            | Required | Default       | Purpose                                                          |
| ------------------- | -------- | ------------- | ---------------------------------------------------------------- |
| `MONGODB_URI`       | yes      | —             | Mongo connection string                                          |
| `JWT_SECRET`        | yes      | —             | HMAC secret for access tokens                                    |
| `JWT_EXPIRES_IN`    | no       | `7d`          | Token lifetime                                                   |
| `PORT`              | no       | `5000`        | HTTP port                                                        |
| `NODE_ENV`          | no       | `development` | `development` \| `production` \| `test`                          |
| `ADMIN_EMAILS`      | no       | `""`          | Comma-separated emails that get the `admin` role on registration |
| `LOG_LEVEL`         | no       | by env        | pino level override                                              |
| `ERROR_WEBHOOK_URL` | no       | —             | if set, 5xx/crash reports are POSTed here as sanitised JSON      |

The frontend has its own build-time variables (Vite inlines any `VITE_`-prefixed
value at `npm run build`, so they live in `frontend/.env`, not `backend/.env`):

| Variable              | Required | Default                     | Purpose                                                                        |
| --------------------- | -------- | --------------------------- | ------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`   | no       | `http://localhost:5000/api` | API origin the browser talks to                                                |
| `VITE_ERROR_ENDPOINT` | no       | —                           | if set, client crashes are POSTed here as sanitised JSON (console-only if not) |

---

## Scripts

From the **repo root** (fans out to both packages):

```bash
npm ci                 # one install, both workspaces (single root lockfile)
npm test               # Jest (backend) then Vitest (frontend) — 666 tests
npm run test:backend   # Jest only
npm run test:frontend  # Vitest only
npm run test:coverage  # both suites with the coverage gate
npm run lint           # ESLint both
npm run typecheck      # tsc --noEmit over @ts-check'd files
npm run build          # vite build -> frontend/dist
```

The root scripts call `jest` and `vitest` directly (both resolve from the
hoisted workspace bin), so there are no per-package steps. See
[Running the tests](#running-the-tests) for what the suites need.

The same scripts also exist inside each workspace, if you prefer to run one
package on its own:

| Script                  | backend                                  | frontend               |
| ----------------------- | ---------------------------------------- | ---------------------- |
| `npm run dev`           | API with nodemon                         | Vite dev server        |
| `npm start` / `build`   | `node server.js`                         | `vite build` → `dist/` |
| `npm test`              | Jest + Supertest against in-memory Mongo | Vitest (jsdom)         |
| `npm run test:coverage` | coverage report                          | coverage report        |
| `npm run lint`          | ESLint                                   | ESLint (react-hooks)   |
| `npm run format:check`  | Prettier                                 | Prettier               |

The backend test suite spins up **mongodb-memory-server**, so it needs no
running database and no `.env` — `npm test` works from a fresh clone. (First
run downloads a MongoDB binary, ~100 MB, cached afterwards.)

**Coverage is gated.** `npm run test:coverage` exits non-zero below the floors
configured in [`backend/jest.config.js`](backend/jest.config.js)
(`coverageThreshold`: 84% statements / 71% branches / 80% functions / 86% lines)
and [`frontend/vite.config.js`](frontend/vite.config.js)
(`coverage.thresholds`: 85 / 79 / 80 / 86). CI runs it on every push, so
coverage cannot silently regress. The floors are ratchets — raise them as
suites grow, never lower them.

---

## Project layout

```
backend/
  app.js            express app (middleware, routes, error handler)
  server.js         process entry: connect DB, listen, crash handlers
  config/           env → config object
  controllers/      one per resource (auth, posts, reactions, feed, admin, …)
  routes/           express routers, mounted in routes/index.js under /api
  models/           Mongoose schemas + hooks ("triggers")
  services/         recommendationService (affinity scoring)
  middleware/       auth, optionalAuth, adminAuth, validate (Joi), rateLimiter,
                    requestLogger (pino-http), errorHandler
  validators/       Joi schemas
  utils/            ApiError, asyncHandler, logger, pagination
  tests/            Jest suites + helpers (in-memory Mongo, factories)
frontend/
  src/pages/        Feed, Explore, Post, Editor, Library, Profile, Auth, Admin, Analytics
  src/components/   NoteCard, layout, dialogs, decor
  src/context/      AuthContext (JWT bootstrap, login/register/logout)
  src/api/axios.js  axios instance with Bearer token interceptor
  src/utils/        postStyle helpers
DEPENDENCIES.md     direct dependencies, currency and deliberate pins
docs/               schema design, API endpoint list, recommender design, ERD
features.md         map of every DB-backed feature and trigger
```

## API overview

Everything is under `/api`. Full list: [`docs/api-endpoints.md`](docs/api-endpoints.md).

| Area       | Routes                                                                                |
| ---------- | ------------------------------------------------------------------------------------- |
| Health     | `GET /health`                                                                         |
| Auth       | `/auth/register`, `/auth/login`, `/auth/me`, password reset, backup-code recovery     |
| Posts      | CRUD `/posts/:id`, `/posts/:id/comments`, `/posts/:id/reactions`, `/posts/:id/repost` |
| Discovery  | `/feed`, `/feed/trending`, `/search`, `/tags`, `/recommendations`                     |
| Social     | `/users/:id`, `/follows`, `/collections`                                              |
| Media      | `/uploads` (stored as binaries in MongoDB, streamed back from `/uploads/:id/file`)    |
| Moderation | `/reports`, `/admin/*`                                                                |
| Analytics  | `/posts/:id/analytics`, `/events`                                                     |

Errors are always JSON: `{ status: "fail" | "error", statusCode, message }`.

## Releasing

There is no hosting target wired up, so nothing deploys automatically — CI
stops at producing the artifacts a maintainer needs, and promotion is a
deliberate manual step.

On every push to `main`, the **Preview · build artifacts** job publishes:

| Artifact           | What it is                                          |
| ------------------ | --------------------------------------------------- |
| `web-bundle-<sha>` | `frontend/dist`, ready to serve as static files     |
| `api-image-<sha>`  | the API container image, `docker save`d and gzipped |

It also writes the bundle sizes into the job summary, so a size regression is
visible on the run without downloading anything.

To promote a green `main`:

1. Check the run is green — all six jobs, including **Clean clone** and
   **Docker · compose build**.
2. Download `web-bundle-<sha>` and upload it to your static host (or serve it
   with the bundled nginx image), and `docker load < api-image.tar.gz` on the
   API host.
3. Set the real environment on the API host — at minimum `MONGODB_URI` and a
   strong `JWT_SECRET`; see [Configuration](#configuration). Point
   `ERROR_WEBHOOK_URL` at your collector if you want error reports forwarded.
4. Confirm `GET /api/health` returns 200 with `db.connected: true`, then watch
   `GET /api/metrics` for error-rate and latency.
5. Tag the release (`git tag -a vX.Y.Z`) and add its entry to
   [CHANGELOG.md](CHANGELOG.md).

## Observability

- `GET /api/health` — liveness/readiness with the mongoose connection state
  (200 when connected, 503 otherwise); used by the Docker healthcheck.
- `GET /api/metrics` — Prometheus exposition with request/error counters, a
  latency histogram (route labels are normalised so ids do not explode
  cardinality) and process uptime/memory gauges.
- Structured logs via pino (`utils/logger.js`), request logs via pino-http.
- Unexpected errors funnel through `utils/errorReporter.js`, which logs with
  context, counts them, and forwards sanitised JSON to `ERROR_WEBHOOK_URL`
  when configured. Keys containing password/token/secret/authorization/cookie
  are stripped before anything leaves the process.
- The React app is wrapped in an `ErrorBoundary`, so a render crash shows a
  recoverable fallback instead of a blank page.

## Data model

See [`docs/schema.md`](docs/schema.md) for the full design and rationale.
Highlights: comments are embedded in `posts` (bounded, always read together);
reactions/follows/analytics are separate unbounded collections; `posts` carries
denormalised `viewCount` / `reactionCount` / `saveCount` maintained by
Mongoose `post('save')` / `post('deleteOne')` hooks; a `searchIndex`
collection is kept in sync by a post-save trigger; the recommender in
`services/recommendationService.js` scores by tag affinity, followed authors,
collaborative overlap and trending, and caches results per user.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: one focused commit per
change, tests land with the code they cover, `npm run lint && npm test` green
in both packages before you push.
