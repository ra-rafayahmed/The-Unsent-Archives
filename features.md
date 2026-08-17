# The Unsent Archives — Database Features

A short, concise map of every database-backed concept in this codebase: which Mongo collections hold what, which triggers fire on writes, how auth works, and where to look for the moderation, reporting, and recovery flows.

## Stack

- MongoDB via Mongoose
- All models live in `backend/models/`
- Controllers in `backend/controllers/`, routes mounted in `backend/routes/index.js`

## Collections (Mongoose models)

| Collection        | File                       | Purpose                                            |
| ----------------- | -------------------------- | -------------------------------------------------- |
| `users`           | `models/User.js`           | Account + auth + recovery state                    |
| `posts`           | `models/Post.js`           | Notes (with embedded `comments`, `media`, `style`) |
| `reactions`       | `models/Reaction.js`       | Heart / felt / cried / wow on a post               |
| `tags`            | `models/Tag.js`            | Tag dictionary with `usageCount`                   |
| `collections`     | `models/Collection.js`     | User-curated stacks of post IDs (public/private)   |
| `follows`         | `models/Follow.js`         | Directed `followerId → followeeId` edges           |
| `mediaAssets`     | `models/MediaAsset.js`     | Uploaded image/audio binaries (`data: Buffer`)     |
| `analyticsEvents` | `models/AnalyticsEvent.js` | Append-only event log (`view`, `save`, `share`)    |
| `searchIndex`     | `models/SearchIndex.js`    | Denormalized text index of public posts            |
| `reports`         | `models/Report.js`         | User-filed reports against posts or accounts       |

## Triggers (Mongoose hooks)

> "Triggers" here are Mongoose `pre`/`post` middleware hooks that run on document writes — same idea as a SQL trigger.

### `User`

- `pre("save")` → bcrypt-hash `passwordHash` whenever it changes
- `pre("save")` → lowercase + trim `email` on every change

### `Post`

- `pre("validate")` → normalize `tagSlugs` (lowercase, kebab-case) and cap embedded `comments` at 500
- `post("save")` → upsert into `searchIndex` so full-text search never drifts
- `post("deleteOne")` (document) → cascade clean: drop dependent reactions, analytics events, search index row, pull from collections (decrement `postCount`), decrement `tags.usageCount`, delete reports targeting this post

### `Reaction`

- `post("save")` → `$inc` `posts.reactionCount` (denormalized counter)
- `post("deleteOne")` (document) → `$inc` `posts.reactionCount` by `-1`, floored at 0

### `Report`

- `post("save")` → `$inc` `reportCount` on the target (`User` or `Post`) so admin lists can sort by "most reported" without an aggregation

## Indexes (notable)

- `users`: `{ username: "text", email: 1 }`
- `posts`: `{ authorId, createdAt }`, `{ visibility, createdAt }`, `{ tagSlugs, createdAt }`, `{ content: "text", tagSlugs: "text" }`
- `reactions`: unique `{ postId, userId, type }` (one of each kind per user/post)
- `reports`: `{ status, createdAt }`, `{ targetType, targetId, status }`

## Authentication & recovery

JWT bearer token, stored client-side, set as `Authorization: Bearer <token>`. Auth handlers live in `backend/controllers/authController.js`.

| Endpoint                                 | Purpose                                                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register`                | Creates a user, hashes password via the `User.pre("save")` trigger, generates **8 single-use backup codes** (`xxxx-xxxx-xxxx`), returns the plaintext codes **once**. |
| `POST /api/auth/login`                   | Bcrypt-compares password. Blocks suspended/deactivated accounts.                                                                                                      |
| `POST /api/auth/forgot-password`         | Generates a 32-byte token, stores its SHA-256 hash + 30-min expiry on the user, returns the raw token in dev (no mail server) so the flow is testable.                |
| `POST /api/auth/reset-password`          | Accepts the raw token, re-hashes & compares, resets `passwordHash` (the `pre("save")` hook re-bcrypts), clears reset fields.                                          |
| `POST /api/auth/recover`                 | **Backup-code recovery.** Email + one of the 8 codes + new password. Marks that code `used: true` and rotates the password.                                           |
| `GET /api/auth/backup-codes`             | Returns `{ total, used, remaining }`.                                                                                                                                 |
| `POST /api/auth/backup-codes/regenerate` | Replaces the user's 8 codes; old codes are invalidated.                                                                                                               |

Backup codes are stored only as SHA-256 hashes on `User.backupCodes[]` (with `select: false`), never in plaintext.

## Admin-issued account recovery

If a user has lost both their password **and** their backup codes, an admin can issue a one-time reset link without seeing or resetting the password directly:

- `POST /api/admin/users/:id/issue-reset` → returns `{ resetToken, resetLink, expiresAt }` to the admin. The same `passwordResetTokenHash` machinery from forgot-password is reused. Admin shares the link out-of-band; the user completes the reset themselves.

## Reports & moderation

Anyone signed in can file a report; admins triage from `/admin`.

- `POST /api/reports` — body `{ targetType: 'post'|'user', targetId, reason, note? }`. Refuses self-reports and silently de-dupes existing open reports per (reporter, target).
- `GET /api/admin/reports?status=open|resolved|dismissed|all` — hydrated with `target` (post snippet / user info) and `reporterId`.
- `PUT /api/admin/reports/:id/resolve` — body `{ action: 'resolved' | 'dismissed' }`. Stamps `resolvedBy` + `resolvedAt`.
- `PUT /api/admin/users/:id/suspend` — `{ suspended: true|false }`. Suspended users can't log in.
- Admin tabs in the UI: **Reports**, **Users** (sortable by `most reported`), **Notes** (sortable by `most reported`).

Reasons enum: `spam`, `harassment`, `hate`, `self-harm`, `nsfw`, `impersonation`, `other`.

## Counters & denormalization

Hot-path read fields are precomputed on writes so the explore feed doesn't aggregate:

- `posts.viewCount` — `$inc` on `GET /posts/:id`
- `posts.reactionCount` — kept in sync by `Reaction` post-save / post-delete triggers
- `posts.saveCount` — `$inc` on add/remove from a `Collection`
- `posts.reportCount` / `users.reportCount` — `$inc` by `Report` post-save trigger
- `tags.usageCount` — `$inc` on tag use, `$inc -1` by post `deleteOne` cascade

## Public collections

- `GET /api/users/:id/collections` returns public collections for non-owners, all for the owner.
- The profile page renders a "Public shelves" section using this endpoint.

## Media uploads (in DB, not on disk)

- Multer uses `memoryStorage()`, the buffer is written to `mediaAssets.data: Buffer`.
- `GET /api/uploads/:id/file` streams the bytes back with the correct `Content-Type` and a per-route `Cross-Origin-Resource-Policy: cross-origin` so cross-port dev embeds work.
- Helmet's app-wide CORP is set to `cross-origin` for the same reason.

## Cascading deletes

| When               | What gets cleaned                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Post.deleteOne     | reactions, analytics events, search index row, collection postIds (`$pull` + `postCount--`), tag usage counts, reports against the post                                                                 |
| Admin deletes user | user's posts (each cascades via post hook), follows (both directions), collections, media assets, embedded comments authored by the user, reactions by the user, reports filed by or targeting the user |
| Reaction.deleteOne | post.reactionCount (`$inc -1`, floored)                                                                                                                                                                 |

## Search

Two-layer:

1. **Mongo text index** on `searchIndex.contentTokens` + `searchIndex.tagSlugs` (kept in sync by the `Post` post-save trigger).
2. The `/api/search` endpoint runs the text query against the index, then hydrates back to `posts` for full data.

## Roles

- `users.role: 'user' | 'admin'` (enum)
- Admin emails configured via `ADMIN_EMAILS` env var auto-promote on registration.
- `middleware/adminAuth.js` (`requireAdmin`) gates `/api/admin/*`.

## File map (where to look)

| You want to find...              | File                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Auth flow + recovery             | `backend/controllers/authController.js`                                               |
| Reports + admin moderation       | `backend/controllers/adminController.js`, `backend/controllers/reportController.js`   |
| Cascade delete + sync triggers   | `backend/models/Post.js`, `backend/models/Reaction.js`, `backend/models/Report.js`    |
| Password & email hashing trigger | `backend/models/User.js`                                                              |
| Media binary storage             | `backend/models/MediaAsset.js`, `backend/controllers/uploadController.js`             |
| Frontend recovery flows          | `frontend/src/pages/Auth/{ForgotPassword,ResetPassword,RecoverWithCode,Register}.jsx` |
| Reporting UI                     | `frontend/src/components/ReportDialog.jsx`                                            |
| Admin panel UI                   | `frontend/src/pages/Admin/AdminDashboard.jsx`                                         |
