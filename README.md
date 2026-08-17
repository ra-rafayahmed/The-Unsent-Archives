# The Unsent Archives

[![CI](https://github.com/ra-rafayahmed/The-Unsent-Archives/actions/workflows/ci.yml/badge.svg)](https://github.com/ra-rafayahmed/The-Unsent-Archives/actions/workflows/ci.yml)

A quiet place for the letters you never sent. Users write styled "notes"
(text, optional image/audio), publish them publicly, to followers, privately, or
anonymously, and browse everyone else's through a feed, search, trending tags,
collections and a personalised recommendation engine. Built as an Advanced
Database Management Systems project around MongoDB: embedded vs referenced
documents, denormalised counters, Mongoose hooks used as write triggers, and a
recommender that keeps per-user affinity profiles.

- **Backend** — Node 20 · Express 4 · Mongoose 8 · JWT auth · Joi validation · pino logging
- **Frontend** — React 19 · Vite · react-router 7 · axios · recharts
- **Tests** — Jest + Supertest + mongodb-memory-server (API) · Vitest + Testing Library (UI)

---

## Quick start

### Option A — Docker (nothing to install but Docker)

```bash
git clone https://github.com/ra-rafayahmed/The-Unsent-Archives.git
cd The-Unsent-Archives
docker compose up --build
```

| Service | URL                              |
| ------- | -------------------------------- |
| Web app | http://localhost:8080            |
| API     | http://localhost:5000/api/health |
| MongoDB | mongodb://localhost:27017 (internal to the compose network) |

Works with no configuration — compose supplies dev defaults and starts its own
MongoDB. To customise (real `JWT_SECRET`, admin emails, different ports, or an
external Atlas database), copy [`.env.example`](.env.example) to `.env` first:

```bash
cp .env.example .env      # then edit JWT_SECRET / ADMIN_EMAILS
docker compose up --build
```

### Option B — Local Node

Prerequisites: Node **20+**, npm, and a MongoDB you can reach (local
`mongod`, `docker run -p 27017:27017 mongo:7`, or an Atlas URI).

```bash
# 1. backend
cd backend
cp .env.example .env         # then edit MONGODB_URI / JWT_SECRET
npm ci
npm run dev                  # http://localhost:5000  (nodemon)

# 2. frontend (new terminal)
cd frontend
npm ci
npm run dev                  # http://localhost:5173
```

The frontend talks to `http://localhost:5000/api` by default; set
`VITE_API_BASE_URL` to point elsewhere.

---

## Configuration

All backend settings come from environment variables (see
[`backend/.env.example`](backend/.env.example)):

| Variable         | Required | Default       | Purpose                                                          |
| ---------------- | -------- | ------------- | ---------------------------------------------------------------- |
| `MONGODB_URI`    | yes      | —             | Mongo connection string                                          |
| `JWT_SECRET`     | yes      | —             | HMAC secret for access tokens                                    |
| `JWT_EXPIRES_IN` | no       | `7d`          | Token lifetime                                                   |
| `PORT`           | no       | `5000`        | HTTP port                                                        |
| `NODE_ENV`       | no       | `development` | `development` \| `production` \| `test`                          |
| `ADMIN_EMAILS`   | no       | `""`          | Comma-separated emails that get the `admin` role on registration |
| `LOG_LEVEL`      | no       | by env        | pino level override                                              |

---

## Scripts

From the **repo root** (fans out to both packages):

```bash
npm run install:all   # npm ci in backend/ and frontend/
npm test              # backend Jest suite, then frontend Vitest suite
npm run lint          # ESLint both
npm run build         # vite build
```

Or run from `backend/` or `frontend/` respectively:

| Script                  | backend                                          | frontend                       |
| ----------------------- | ------------------------------------------------ | ------------------------------ |
| `npm run dev`           | API with nodemon                                 | Vite dev server                |
| `npm start` / `build`   | `node server.js`                                 | `vite build` → `dist/`         |
| `npm test`              | Jest + Supertest against in-memory Mongo         | Vitest (jsdom)                 |
| `npm run test:coverage` | coverage report                                  | coverage report                |
| `npm run lint`          | ESLint                                           | ESLint (react-hooks)           |
| `npm run format:check`  | Prettier                                         | Prettier                       |

The backend test suite spins up **mongodb-memory-server**, so it needs no
running database and no `.env` — `npm test` works from a fresh clone. (First
run downloads a MongoDB binary, ~100 MB, cached afterwards.)

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
docs/               schema design, API endpoint list, recommender design, ERD
features.md         map of every DB-backed feature and trigger
```

## API overview

Everything is under `/api`. Full list: [`docs/api-endpoints.md`](docs/api-endpoints.md).

| Area            | Routes                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| Health          | `GET /health`                                                                 |
| Auth            | `/auth/register`, `/auth/login`, `/auth/me`, password reset, backup-code recovery |
| Posts           | CRUD `/posts/:id`, `/posts/:id/comments`, `/posts/:id/reactions`, `/posts/:id/repost` |
| Discovery       | `/feed`, `/feed/trending`, `/search`, `/tags`, `/recommendations`             |
| Social          | `/users/:id`, `/follows`, `/collections`                                      |
| Media           | `/uploads` (stored as binaries in MongoDB, streamed back from `/uploads/:id/file`) |
| Moderation      | `/reports`, `/admin/*`                                                        |
| Analytics       | `/posts/:id/analytics`, `/events`                                             |

Errors are always JSON: `{ status: "fail" | "error", statusCode, message }`.

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
