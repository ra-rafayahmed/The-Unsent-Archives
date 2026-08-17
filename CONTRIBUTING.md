# Contributing

## Setup

```bash
git clone https://github.com/ra-rafayahmed/The-Unsent-Archives.git
cd The-Unsent-Archives
npm ci        # npm workspaces: installs backend/ and frontend/ in one go
npm test      # runs both suites
```

Backend tests need no database (they use `mongodb-memory-server`). To run the
app itself, follow the Quick start in the [README](README.md).

## Before you push

Run in **both** `backend/` and `frontend/`:

```bash
npm run lint
npm run format:check   # or `npm run format` to fix
npm run typecheck      # backend: tsc --noEmit over @ts-check'd files
npm test
```

CI runs exactly these, plus `npm run build` for the frontend and a
`docker compose` smoke test. A PR must be green to merge.

`npm run test:coverage` enforces minimum coverage (see `coverageThreshold` in
`backend/jest.config.js` and `coverage.thresholds` in `frontend/vite.config.js`)
and CI runs it, so a change that drops coverage below the floor fails the
build. When a change pushes coverage meaningfully above a floor, raise that
floor in the same PR — the numbers are a ratchet and should never go down.

## Commit discipline

- **One change per commit.** A feature, a bug fix, a refactor, a formatting
  pass — never mixed. If a commit message needs the word "and", split it.
- **Tests travel with the code.** A commit that adds or changes behaviour
  includes the test that pins it (`backend/tests/*.test.js`,
  `frontend/src/**/*.test.jsx`). Bug fixes start with a failing test.
- **Message format:** `<area>: <imperative summary>` on the first line
  (`backend: fix reactionCount double-increment`, `frontend: add Explore
search tests`, `ci: cache npm`), then a blank line and a short body
  explaining _why_ when it isn't obvious.
- Prefer small PRs. Rebase on `main` rather than merge-committing.

## Where things go

| I want to…                       | Touch                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| add an API endpoint              | `backend/routes/*`, `backend/controllers/*`, a Joi schema in `backend/validators/*`, and a test in `backend/tests/`                                  |
| change a Mongo schema or trigger | `backend/models/*` and update `docs/schema.md` / `features.md`                                                                                       |
| add a page or component          | `frontend/src/pages/*` or `src/components/*` plus a `*.test.jsx` next to it                                                                          |
| add an env var                   | `backend/config/index.js`, `backend/.env.example`, README table, `docker-compose.yml`                                                                |
| add a dependency                 | `npm install` in the right package and commit the lockfile — then run `npx -y npm@10 install --package-lock-only` before committing (see note below) |

## Type checking

The backend runs `tsc --noEmit` in CI, but checking is **opt-in per file**: a
module is only checked once it carries a `// @ts-check` pragma and JSDoc types
(see `backend/utils/*.js`). This is a ratchet — when you touch a file, add the
pragma and its `@param`/`@returns` annotations, and it stays checked from then
on. Do not remove a pragma to make an error go away.

Currently checked: `backend/utils/**`. Models and services still need Mongoose
document typings that are awkward to express in JSDoc; those come later.

## Coverage baseline

As of v1.2.0 (`npm run test:coverage` at the root):

| Package  | Statements | Branches | Functions | Lines |
| -------- | ---------- | -------- | --------- | ----- |
| backend  | 86.8%      | 74.4%    | 83.3%     | 89.1% |
| frontend | 88.3%      | 82.7%    | 82.9%     | 89.8% |

The gates in `backend/jest.config.js` and `frontend/vite.config.js` sit just
below these. Raise them when you push coverage meaningfully higher.

## Workspaces and the lockfile

This is an **npm workspaces** monorepo: `backend` and `frontend` are workspaces
of the root package, and there is exactly **one** lockfile
(`/package-lock.json`). Do not create per-package lockfiles. Install and script
commands run from the root:

```bash
npm ci                              # both workspaces
npm run lint  --workspace backend   # single workspace
npm install <pkg> --workspace frontend
```

**Lockfile gotcha (Windows + npm 11):** npm 11 on Windows writes a lockfile
that omits the peer deps of some platform-optional packages (`@emnapi/*` via
`@napi-rs/wasm-runtime`); `npm ci` on Linux/CI then fails with "package.json
and package-lock.json are not in sync". After any `npm install`, normalise it:

```bash
npx -y npm@10 install --package-lock-only --ignore-scripts
```

The result is a superset that both npm 10 and 11 accept.

## Testing conventions

- Backend: integration tests through Supertest against the real Express app.
  Use `tests/helpers/factories.js` (`registerUser`, `createPost`, `authHeader`).
  Collections are wiped between tests.
- Frontend: Testing Library, query by role/text, mock `src/api/axios` with
  `vi.mock`, wrap router-dependent components with `renderWithRouter` from
  `src/test/utils.jsx`.
- Don't assert on implementation details (class names, internal state)
  unless that _is_ the behaviour (e.g. the NoteCard variant class).
