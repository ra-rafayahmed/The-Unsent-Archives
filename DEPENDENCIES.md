# Dependencies

One lockfile (`/package-lock.json`) covers both workspaces — this is an npm
workspaces monorepo, so `npm ci` at the root installs everything.

Run `npm outdated --workspaces` to reproduce the table below, and
`npm audit --audit-level=high` for vulnerabilities (CI fails the build on
high or critical findings).

## Direct dependencies

### backend (`backend/package.json`)

| Package            | Range     | Purpose                                 |
| ------------------ | --------- | --------------------------------------- |
| express            | ^5.2.1    | HTTP framework                          |
| mongoose           | ^9.9.3    | MongoDB ODM                             |
| joi                | ^18.2.3   | Request-body validation at the boundary |
| jsonwebtoken       | ^9.0.2    | Access tokens                           |
| bcryptjs           | ^3.0.3    | Password hashing                        |
| helmet             | ^8.3.0    | Security headers                        |
| cors               | ^2.8.5    | Cross-origin access for the SPA         |
| express-rate-limit | ^8.6.2    | Global and auth rate limits             |
| multer             | ^2.1.1    | Multipart uploads (memory storage)      |
| pino / pino-http   | ^10 / ^11 | Structured logging                      |
| dotenv             | ^17.4.2   | Local env loading                       |

Dev: jest, supertest, mongodb-memory-server, eslint, prettier, typescript,
@types/{node,express,jest}, nodemon, cross-env.

### frontend (`frontend/package.json`)

| Package           | Range   | Purpose          |
| ----------------- | ------- | ---------------- |
| react / react-dom | ^19.2.5 | UI               |
| react-router-dom  | ^7.14.2 | Routing          |
| axios             | ^1.15.2 | API client       |
| recharts          | ^3.8.1  | Analytics charts |
| react-masonry-css | ^1.0.16 | Feed layout      |

Dev: vite, @vitejs/plugin-react, vitest, @testing-library/*, jsdom, eslint,
prettier, typescript, @types/react{,-dom}.

## Currency

Checked 2026-08-18 with `npm outdated --workspaces`: everything is on its
latest stable major. Dependabot watches the root manifest weekly for npm,
GitHub Actions and Docker base images, grouping minor/patch updates into a
single PR and leaving majors separate for review.

Two deliberate pins worth knowing about:

- **Node 22 LTS** (`engines`, CI, Dockerfiles) — jsdom 30 needs
  `worker_threads.markAsUncloneable` via undici 8, which Node 20 lacks.
- **TypeScript 6** — used only for `tsc --noEmit` JSDoc checking; 7.x is
  available and can be adopted once the checked surface grows.
