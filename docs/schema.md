# The Unsent Archives — Schema Design

10 MongoDB collections. Each one has a clear purpose and a deliberate reason it isn't embedded in something else. Counters that look "redundant" are denormalized caches kept in sync by Mongoose hooks (see `features.md` for the trigger map).

---

## Collection map

| # | Collection | Lives in | Holds |
|---|---|---|---|
| 1 | `users` | `models/User.js` | Accounts, auth state, recovery codes, moderation flags |
| 2 | `posts` | `models/Post.js` | Notes (with **embedded** comments, media, style) |
| 3 | `reactions` | `models/Reaction.js` | One row per (user, post, type) reaction |
| 4 | `tags` | `models/Tag.js` | Tag dictionary with `usageCount` + `category` |
| 5 | `collections` | `models/Collection.js` | User-curated stacks of post IDs |
| 6 | `follows` | `models/Follow.js` | `followerId → followeeId` edges |
| 7 | `mediaAssets` | `models/MediaAsset.js` | Uploaded image/audio binaries (`data: Buffer`) |
| 8 | `analyticsEvents` | `models/AnalyticsEvent.js` | Append-only event log with 90-day TTL |
| 9 | `searchIndex` | `models/SearchIndex.js` | Denormalized text-search shadow of public posts |
| 10 | `reports` | `models/Report.js` | User-filed reports against posts/users |

---

## 1. `users`

Account, auth, recovery, role, soft-moderation. Email and username are unique. Password is bcrypt-hashed by a `pre("save")` trigger; backup codes are SHA-256 hashed.

```
{
  _id, username (unique), email (unique, lowercased),
  passwordHash (select:false),
  avatarUrl, bio,
  isActive, isSuspended, role: "user" | "admin",
  profile: { displayName, location, website },
  tagInterests: [Tag],
  passwordResetTokenHash, passwordResetExpires,   (select:false)
  backupCodes: [{ codeHash, used, usedAt }],      (select:false)
  reportCount,
  createdAt, updatedAt
}
```

**Indexes:** `{ username: "text", email: 1 }`
**Triggers:** `pre("save")` → hash password if changed; lowercase email.

---

## 2. `posts`

The core entity. Comments and media are **embedded** (bounded ≤ 500 / small list). Reactions are **referenced** because they're unbounded and write-heavy — embedding them would push popular posts toward Mongo's 16 MB doc cap. Tag IDs are referenced for metadata; tag slugs are denormalized for filter-without-join.

```
{
  _id, authorId → User,
  content (1..5000), visibility: "public"|"followers"|"private",
  isAnonymous, repostOf → Post|null,

  style: {
    font, background, textColor,
    fontSize, lineHeight, letterSpacing, textAlign
  },
  media: [{ url, type: "image"|"video"|"audio", mimeType, width, height }],

  tagIds: [Tag],
  tagSlugs: [String],   // denormalized

  // denormalized counters (kept in sync by triggers / $inc)
  viewCount, reactionCount, saveCount, reportCount,

  comments: [{ _id, userId → User, text (≤1000), isAnonymous, createdAt }],   // capped at 500

  createdAt, updatedAt
}
```

**Indexes:** `{ authorId, createdAt }`, `{ visibility, createdAt }`, `{ tagSlugs, createdAt }`, `{ content: "text", tagSlugs: "text" }`.
**Triggers:**
- `pre("validate")` → normalize tag slugs, cap comments at 500
- `post("save")` → upsert into `searchIndex`
- `post("deleteOne")` → cascade clean reactions, analytics, search index, collection memberships, tag usage counts, reports targeting this post

---

## 3. `reactions`

Separate collection because reactions are unbounded and high write volume. The unique compound index enforces "one of each emoji per user per post."

```
{ _id, postId → Post, userId → User, type: enum, reactedAt }
```

**Indexes:** unique `{ postId, userId, type }`, `{ postId, type }`, `{ userId, reactedAt }`.
**Triggers:** `post("save")` → `$inc posts.reactionCount`. `post("deleteOne")` → `$inc -1`, floored at 0.

---

## 4. `tags`

Tag dictionary. Posts reference tags by id (canonical) and slug (fast filtering).

```
{ _id, name (unique), slug (unique, lowercase), category, usageCount }
```

**Indexes:** unique on `name` and `slug`, `{ category }`, `{ usageCount }` desc, text on `{ name, slug }`.
`usageCount` is incremented at post-create and decremented by the `Post.post("deleteOne")` cascade.

---

## 5. `collections`

User-curated lists ("shelves") of post references. `postCount` is denormalized so the Library page doesn't need to count the array.

```
{
  _id, ownerId → User,
  name, description,
  visibility: "public"|"private",
  postIds: [Post],
  postCount,
  createdAt, updatedAt
}
```

**Indexes:** `{ ownerId, createdAt }`, `{ visibility, createdAt }`, `{ postIds }`.
Mutated through `addPost` / `removePost` controllers, which also `$inc posts.saveCount`.

---

## 6. `follows`

Many-to-many directed edges. Separate collection because a user can follow thousands of people — embedding would balloon User docs.

```
{ _id, followerId → User, followeeId → User, followedAt }
```

**Indexes:** unique `{ followerId, followeeId }` (no double-follow), plus directional sort indexes for "who do I follow" and "who follows me".

---

## 7. `mediaAssets`

Uploaded binaries are stored **inside Mongo** as a `Buffer` rather than on disk. The streamer route `GET /api/uploads/:id/file` reads the buffer back out with the right `Content-Type`.

```
{
  _id, ownerId → User,
  url,                   // /api/uploads/:id/file
  fileName, mimeType, size,
  mediaType: "image"|"audio",
  data: Buffer (select:false),   // the actual bytes
  createdAt, updatedAt
}
```

**Indexes:** `{ ownerId, createdAt }`.
Why DB instead of disk: portability (no host filesystem dependency), CORP/CORS works through one origin, deletes/cleanup are atomic with the doc.

---

## 8. `analyticsEvents`

Append-only event log. **TTL index** auto-deletes events after 90 days so this collection doesn't grow unbounded.

```
{
  _id, postId → Post, actorId → User|null,
  eventType: "view"|"click"|"share"|"save"|"report",
  ipHash,
  metadata: { userAgent, referer, platform },
  occurredAt
}
```

**Indexes:** `{ occurredAt }` with `expireAfterSeconds: 7776000` (90 d), `{ postId, eventType, occurredAt }`, `{ actorId, eventType, occurredAt }`.

---

## 9. `searchIndex`

Denormalized shadow collection used **only** for `$text` search. Keeps the main `posts` collection fast for normal queries by isolating the heavy text-index from it. Kept in sync by `Post.post("save")` and `Post.post("deleteOne")` triggers.

```
{
  _id, postId → Post (unique),
  contentTokens, tagSlugs: [String],
  authorUsername, visibility,
  createdAt, updatedAt
}
```

**Indexes:** unique `{ postId }`; `{ contentTokens, authorUsername, tagSlugs }` text with weights (3/1/2); `{ visibility, createdAt }`.

---

## 10. `reports`

User-filed reports about posts or users. Admins triage from `/admin`.

```
{
  _id, reporterId → User,
  targetType: "post"|"user",
  targetId → Post|User (refPath),
  reason: enum(spam|harassment|hate|self-harm|nsfw|impersonation|other),
  note (≤500),
  status: "open"|"resolved"|"dismissed",
  resolvedBy → User|null, resolvedAt,
  createdAt, updatedAt
}
```

**Indexes:** `{ status, createdAt }`, `{ targetType, targetId, status }`, `{ reporterId, targetType, targetId }`.
**Triggers:** `post("save")` → if `status === "open"`, `$inc reportCount` on the target (User or Post) so admin lists can sort by "most reported" without an aggregation.

---

## Relationship diagram (logical)

```
                 ┌────────┐         ┌────────┐
                 │ users  │◄───┐    │  tags  │
                 └────┬───┘    │    └───▲────┘
        owns / authors│        │         │
                      ▼        │         │ tagged-by
                 ┌────────┐    │    ┌────┴────┐
   reacts-on ──► │ posts  │────┴───►│         │
                 └────────┘ embeds  │         │
                      ▲    └─ comments        │
                      │                       │
   ┌──────────────────┼──────────────────┐    │
   │                  │                  │    │
┌──┴────┐        ┌────┴────┐        ┌────┴────┐
│reaction│        │collections│      │ reports │
└───────┘        │ (postIds) │      │(target..)│
                 └─────┬─────┘      └─────────┘
                       │
            ┌──────────┘
            ▼                       ┌─────────────┐
       ┌─────────┐                  │mediaAssets  │
       │ follows │                  │(post.media  │
       │ (user→user)                │ stores url) │
       └─────────┘                  └─────────────┘

                                     ┌────────────────┐
   posts.post-save  ──upserts──►     │  searchIndex   │
                                     └────────────────┘

   user actions ───logs───►  ┌──────────────────┐
                             │ analyticsEvents  │  (TTL 90d)
                             └──────────────────┘
```

---

## Embed vs reference — the rationale

| Concept | Decision | Why |
|---|---|---|
| Comments (in posts) | **Embed** | Bounded (≤ 500), always loaded with the post, never queried independently. |
| Media on a post | **Embed** | A note has a handful of attachments; tightly bound to the parent. The bytes themselves live in `mediaAssets` and the embed only stores a URL. |
| Reactions | **Reference** | Unbounded, write-heavy, would push popular posts past 16 MB. |
| Follows | **Reference** | Many-to-many, unbounded, queried in both directions. |
| Tags ↔ Posts | **Both** (id + slug) | Slug is denormalized on Post for fast filtering without a join; id keeps a canonical link to tag metadata. |
| Backup codes (in user) | **Embed** | Bounded (8 codes), always read together with the user, never queried alone. |
| Reports | **Reference** | High write volume; needs status workflow, sortable lists, and TTL/cleanup independent of users/posts. |

---

## Counters & TTLs (the moving parts)

- `posts.viewCount` — `$inc` on `GET /posts/:id`
- `posts.reactionCount` — kept in sync by `Reaction` post-save / post-delete triggers
- `posts.saveCount` — `$inc ±1` on collection add/remove
- `posts.reportCount`, `users.reportCount` — `$inc` by `Report` post-save trigger
- `tags.usageCount` — `$inc` at post create, `$inc -1` by `Post.post("deleteOne")` cascade
- `collections.postCount` — `$inc ±1` on collection add/remove + `$pull` cascade on post delete
- `analyticsEvents` — TTL index expires rows 90 days after `occurredAt`

The source of truth for any counter is the underlying collection it summarizes (`reactions`, `analyticsEvents`, etc.). Counters can drift if a write skips the API path; going through controllers keeps everything consistent because the triggers fire there.
