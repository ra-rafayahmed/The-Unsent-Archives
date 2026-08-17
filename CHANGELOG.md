# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.3.0] — 2026-08-17

### Added

- Opt-in JSDoc type checking on the backend (`npm run typecheck`, `tsc
--noEmit`, run in CI). Files opt in with `// @ts-check`; `backend/utils/**`
  is annotated and checked under `strict`.
- Joi schemas for the last five body-carrying routes (profile update, repost,
  add-post-to-collection, resolve-report, recommendations refresh). Every
  remaining unvalidated mutating route takes no body or is a multipart upload.
- Root-level files (README, compose, workflows) are now format-checked in CI;
  prettier is a root devDependency and the root scripts cover those globs.
- Coverage baseline recorded in CONTRIBUTING, measured from a fresh clone.

### Fixed

- **Tag counters drifted.** `updatePost` re-incremented every tag on each save
  and never decremented removed ones (a shortcut the source admitted to), and
  `deletePost` repeated the cascade the model hook already runs, so each delete
  subtracted twice. Counts now move by the difference between the post's old
  and new tag sets, and the hook owns the cascade.
- **followers-only posts were readable by anyone** holding the post id — the
  `TODO` in `getPost`. A Follow edge is now required unless the viewer is the
  author.
- Profile update rejects unknown keys instead of silently dropping them, so a
  role/isSuspended escalation attempt fails loudly.
- Replaced mongoose's deprecated `new: true` with `returnDocument`, which
  warned on every `findOneAndUpdate` under Mongoose 9.

[1.3.0]: https://github.com/ra-rafayahmed/The-Unsent-Archives/compare/v1.2.0...v1.3.0

## [1.2.0] — 2026-08-17

### Added

- `App.test.jsx` and `NoteComments` tests; 33 frontend suites / 289 tests.
- CI annotates the failing vitest output on the commit, so a CI-only failure
  is diagnosable without downloading the job log.

### Changed

- **Requires Node 22 LTS.** jsdom 30 (via undici 8) needs
  `worker_threads.markAsUncloneable`, absent on Node 20; CI, both Dockerfiles
  and every `engines` field move to 22, which also clears GitHub's Node 20
  deprecation warning.
- Dependencies: mongoose 8 -> 9, joi 17 -> 18, dotenv 16 -> 17, jsdom 29 -> 30,
  nginx 1.27 -> 1.31. Mongoose 9 no longer passes `next` to schema middleware,
  so the five hooks in User, Post, Report and Recommendation were migrated to
  the async/return form.
- Routes are code-split with `React.lazy`: the entry bundle drops from
  743.98 kB to 248.84 kB (gzip 220.74 -> 79.03 kB) and no chunk trips Vite's
  500 kB warning — recharts now loads only with `/analytics`.
- `NoteComments` extracted from `SingleNoteView` (423 -> 348 LOC).

[1.2.0]: https://github.com/ra-rafayahmed/The-Unsent-Archives/compare/v1.1.0...v1.2.0

## [1.1.0] — 2026-08-17

Test breadth, observability, boundary validation, and a batch of bug fixes
found by writing the tests.

### Added

- Test suites for every previously untested module: backend user/tag/search,
  report/admin/analytics/upload, boundary validation, metrics, error reporter
  and pagination; frontend auth pages, axios client, route guard, layout
  chrome, library pages, HomePage, AnalyticsDashboard, AdminDashboard and the
  note editor. **210 backend + 271 frontend tests** (was 57 + 31).
- `GET /api/metrics` — dependency-free Prometheus exposition with request and
  error counters, a latency histogram with normalised route labels, and
  process uptime/memory gauges.
- `utils/errorReporter.js` — every unexpected 5xx and both process crash
  handlers funnel through one seam that logs with context, counts the error,
  and optionally forwards sanitised JSON to `ERROR_WEBHOOK_URL`.
- Frontend `ErrorBoundary` around the router, plus `utils/apiError.js`
  (`toUserMessage`) replacing 18 hand-rolled `err?.response?.data?.message`
  chains with status-aware messages.
- Joi validation on every mutating boundary that previously validated ad-hoc
  or not at all: reactions, comments, follows, reports, analytics events and
  the admin role/suspend routes.
- Custom hooks `useUserProfile`, `useNoteEditor`, `useAdminDashboard`
  (alongside the existing `usePost`), and `utils/color.js`, extracted from the
  four largest page components.
- CI job **Clean clone**, proving the documented two-command setup
  (`npm ci && npm test`) on a runner with no cache.

### Fixed

- **Pagination:** `?page=-5` produced a negative `skip`, which MongoDB
  rejects — a 500 on every paginated endpoint. Page and limit are clamped.
- **Search regex injection:** `?user=.*` matched every author and returned all
  public posts; `?q=(` made MongoDB reject the query and returned 500. Both
  inputs are escaped.
- **Suspensions:** `PUT /admin/users/:id/suspend` read `Boolean(body.suspended)`,
  so an empty body or a typo silently _lifted_ an active suspension.
- **Profile leak:** `GET /users/:id` exposed `role`, `reportCount` and
  `isSuspended`; the response is now an explicit allowlist.
- **Analytics abuse:** `POST /events` accepted unauthenticated writes for
  arbitrary post ids without checking the post existed.
- **Tag casing:** `/api/tags/Grief/posts` returned nothing because stored slugs
  are lowercase.
- **Silent failures:** failed loads on the feed, collections board, collection
  detail and note editor showed empty states indistinguishable from "you have
  nothing" (and escaped as unhandled rejections). All now report and retry.
- **Moderation:** admin actions had no error handling, so a 403 vanished
  silently; and declining the "Delete this post?" confirm still closed the
  report while leaving the note in place.
- **Analytics dashboard** painted zeros and three empty states before its
  requests resolved.
- Route-change scrolling never used the instant path (`"instant" in window` is
  always false), and MobileNav icon ligatures leaked into accessible names.

### Changed

- **Repository is now an npm workspaces monorepo** with a single root lockfile;
  `npm ci && npm test` at the root installs and tests everything. Dockerfiles
  build from the repo root, and Dependabot watches `/` for npm.
- Coverage gates raised from 60/40/50/60 and 44/37/38/44 to **84/71/80/86**
  (backend) and **85/79/80/86** (frontend).
- Test fixtures generate their passwords instead of using a literal.
- Backend test suite awaits index builds, removing `$text` search flakiness;
  Vitest worker options migrated to the Vitest 4 top-level form (the previous
  `poolOptions` block was silently ignored).

## [1.0.0] — 2026-08-16

First tagged release: the full app plus the engineering baseline that makes it
buildable and testable from a fresh clone.

### Added

- Backend test harness: Jest + Supertest + mongodb-memory-server; suites for
  auth, posts, reactions, follows, collections, feed and health (~60 tests).
- Frontend test harness: Vitest + React Testing Library; suites for
  `postStyle`, `NoteCard`, `AuthContext`/`ProtectedRoute`, `ExplorePage`, `Login`.
- `GET /api/health` liveness/readiness endpoint reporting Mongo connection state.
- Structured logging with pino / pino-http (pretty in dev, JSON in prod,
  silent in tests, secrets redacted); replaces morgan and all `console.*`.
- ESLint (flat config) + Prettier in both packages, `.editorconfig`,
  `.gitattributes` (LF everywhere).
- GitHub Actions CI: lint, format check, tests and build for both packages,
  plus a docker-compose smoke test; Dependabot for npm, Actions and Docker.
- Dockerfiles for API (non-root, healthcheck) and web (nginx with `/api`
  proxy + SPA fallback); `docker-compose.yml` with MongoDB for one-command startup.
- README, CONTRIBUTING, this changelog; complete `backend/.env.example`.

### Fixed

- Reactions were counted twice on `Post.reactionCount` (model hook and
  controller both incremented). Controller-side increment removed.
- Rate limiter now honours `trust proxy` so client IPs are correct behind nginx.

### Changed

- Rate limiting and request logging are disabled under `NODE_ENV=test`;
  bcrypt uses cheap rounds in tests so the suite runs in seconds.
- Stale `backend/uploads/` images removed from git (media lives in MongoDB).
- `npm audit fix` applied in both packages (0 known vulnerabilities).

[1.0.0]: https://github.com/ra-rafayahmed/The-Unsent-Archives/releases/tag/v1.0.0
[Unreleased]: https://github.com/ra-rafayahmed/The-Unsent-Archives/compare/v1.3.0...HEAD
[1.1.0]: https://github.com/ra-rafayahmed/The-Unsent-Archives/compare/v1.0.0...v1.1.0
