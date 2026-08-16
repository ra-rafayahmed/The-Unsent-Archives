# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/ra-rafayahmed/The-Unsent-Archives/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ra-rafayahmed/The-Unsent-Archives/releases/tag/v1.0.0
