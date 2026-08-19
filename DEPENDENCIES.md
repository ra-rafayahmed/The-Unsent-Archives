# Dependencies

> **Where the manifests live.** This is an npm **workspaces** monorepo, so the
> root `package.json` intentionally declares no runtime dependencies — it holds
> only the workspace list, shared scripts and `prettier`. Every runtime
> dependency is declared in `backend/package.json` or `frontend/package.json`,
> and one lockfile (`/package-lock.json`) pins the whole tree. Tools that read
> only the root manifest will report zero direct dependencies; the real lists
> are reproduced verbatim below and can be checked with:
>
> ```bash
> npm ls --workspaces --depth=0
> npm outdated --workspaces
> ```

One lockfile (`/package-lock.json`) covers both workspaces — this is an npm
workspaces monorepo, so `npm ci` at the root installs everything.

Run `npm outdated --workspaces` to reproduce the table below, and
`npm audit --audit-level=high` for vulnerabilities (CI fails the build on
high or critical findings).

## Direct dependencies

Copied from the workspace manifests; run `npm ls --workspaces --depth=0` to confirm.

### backend (`backend/package.json`)

| Package              | Range     |
| -------------------- | --------- |
| `bcryptjs`           | `^3.0.3`  |
| `cors`               | `^2.8.5`  |
| `dotenv`             | `^17.4.2` |
| `express`            | `^5.2.1`  |
| `express-rate-limit` | `^8.6.2`  |
| `helmet`             | `^8.3.0`  |
| `joi`                | `^18.2.3` |
| `jsonwebtoken`       | `^9.0.2`  |
| `mongoose`           | `^9.9.3`  |
| `multer`             | `^2.1.1`  |
| `pino`               | `^10.3.1` |
| `pino-http`          | `^11.0.0` |

Dev: `@eslint/js`, `@types/express`, `@types/jest`, `@types/node`, `cross-env`, `eslint`, `eslint-config-prettier`, `eslint-plugin-jest`, `globals`, `jest`, `mongodb-memory-server`, `nodemon`, `pino-pretty`, `prettier`, `supertest`, `typescript`.

### frontend (`frontend/package.json`)

| Package             | Range     |
| ------------------- | --------- |
| `axios`             | `^1.15.2` |
| `react`             | `^19.2.8` |
| `react-dom`         | `^19.2.8` |
| `react-masonry-css` | `^1.0.16` |
| `react-router-dom`  | `^7.14.2` |
| `recharts`          | `^3.10.1` |

Dev: `@eslint/js`, `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@vitest/coverage-v8`, `eslint`, `eslint-config-prettier`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `jsdom`, `prettier`, `typescript`, `vite`, `vitest`.

## Currency

Checked 2026-08-19 with `npm outdated --workspaces`: everything is on its
latest stable major. Dependabot watches the root manifest weekly for npm,
GitHub Actions and Docker base images, grouping minor/patch updates into a
single PR and leaving majors separate for review.

Two deliberate pins worth knowing about:

- **Node 22 LTS** (`engines`, CI, Dockerfiles) — jsdom 30 needs
  `worker_threads.markAsUncloneable` via undici 8, which Node 20 lacks.
- **TypeScript 6** — used only for `tsc --noEmit` JSDoc checking; 7.x is
  available and can be adopted once the checked surface grows.
