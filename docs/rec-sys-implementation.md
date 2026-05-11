# Recommendation System – Implementation Reference

> **Purpose:** This document describes the fully-implemented recommendation system in
> `The-Unsent-Archives` backend. It is intended as a handoff reference for a developer
> or AI model that needs to understand, extend, or connect a frontend to this feature.

---

## Table of Contents

1. [Overview](#overview)
2. [File Map](#file-map)
3. [Database Schema](#database-schema)
4. [Service Layer (Algorithm)](#service-layer-algorithm)
5. [API Endpoints](#api-endpoints)
6. [Authentication](#authentication)
7. [Integration Points (already wired)](#integration-points-already-wired)
8. [Frontend Integration Guide](#frontend-integration-guide)
9. [Tuning Constants](#tuning-constants)
10. [Future Enhancements (not yet built)](#future-enhancements-not-yet-built)

---

## Overview

The recommendation system personalises each user's feed by combining four independent
scoring strategies. Each strategy adds score to a shared `Map` keyed by post ID.
Posts that match multiple strategies accumulate higher scores and bubble to the top.

```
User request
    │
    ▼
RecommendationService.getRecommendations(userId, limit)
    │
    ├─ Strategy 1: Tag-based filtering      (score +=  10 × matched-tag-count)
    ├─ Strategy 2: Collaborative filtering  (score +=  8)
    ├─ Strategy 3: Trending posts           (score +=  engagement × recency-decay)
    └─ Strategy 4: Follow network           (score += 12)
    │
    ▼
Sort Map values by score DESC → slice to limit → return ranked list
```

---

## File Map

| Path | Role |
|---|---|
| `backend/models/Recommendation.js` | MongoDB schema — user preference profile + recommendation cache |
| `backend/services/recommendationService.js` | Core algorithm (all four strategies) |
| `backend/routes/recommendationRoutes.js` | Express routes for the two API endpoints |
| `backend/routes/index.js` | **Already updated** — mounts routes at `/api/recommendations` |
| `backend/models/index.js` | **Already updated** — exports `Recommendation` model |

---

## Database Schema

### `Recommendation` collection (`backend/models/Recommendation.js`)

One document per user (enforced by `unique: true` on `userId`).

```js
{
  userId: ObjectId,           // ref: "User", unique

  // Weighted tag interest scores derived from engagement history
  tagInterests: [
    { tagId: ObjectId,          // ref: "Tag"
      score: Number }           // higher = stronger affinity
  ],

  // Per-author affinity scores
  followingTrend: [
    { followedUserId: ObjectId, // ref: "User"
      score: Number }
  ],

  // Raw engagement events (used to update scores above)
  // Weight guideline: view≈1, save≈2, react≈3, comment≈5
  engagementHistory: [
    { postId:     ObjectId,     // ref: "Post"
      engagement: String,       // enum: "view" | "save" | "react" | "comment"
      weight:     Number,
      timestamp:  Date }
  ],

  // Pre-computed recommendation cache (written by POST /refresh)
  recommendedPosts: [
    { postId:    ObjectId,      // ref: "Post"
      score:     Number,
      reason:    String,        // enum: "tag-match" | "collaborative-filter"
                                //        | "trending" | "follow-network"
      createdAt: Date }
  ],

  lastUpdated: Date,
  createdAt:   Date,
  updatedAt:   Date
}
```

**Index:** `userId` (unique constraint creates the index automatically).

### Existing collections used (read-only by this feature)

| Collection | Fields read |
|---|---|
| `users` | `tagInterests` (array of Tag ObjectIds) |
| `posts` | `tagIds`, `authorId`, `visibility`, `reactionCount`, `viewCount`, `isAnonymous`, `createdAt` |
| `reactions` | `userId`, `postId` |
| `follows` | `followerId`, `followeeId` |

---

## Service Layer (Algorithm)

**File:** `backend/services/recommendationService.js`

### Entry point

```js
const RecommendationService = require("../services/recommendationService");

const recs = await RecommendationService.getRecommendations(userId, limit);
// Returns: Array<{ postId: ObjectId, score: Number, reason: String }>
```

### Strategy 1 – Tag-based filtering (`_addTagBasedRecs`)

1. Read `user.tagInterests` (array of Tag ObjectIds from the User document).
2. Query `Post` collection: `tagIds: { $in: tagIds }`, `visibility: "public"`, exclude own posts, limit 50.
3. For each post count how many of the post's tags match the user's interest list.
4. Score = `matchedCount × TAG_SCORE_PER_MATCH` (default: `10`).

### Strategy 2 – Collaborative filtering (`_addCollaborativeRecs`)

1. Find all posts the current user has reacted to → `engagedPostIds`.
2. Find other users who also reacted to those posts → `similarUserIds`.
3. Find posts that *similar users* reacted to (excluding posts the current user already reacted to) → `candidatePostIds`.
4. Fetch those posts (visibility `"public"`, not authored by current user, limit 50).
5. Score each hit += `COLLABORATIVE_SCORE` (default: `8`).

> **Cold-start:** If the user has no reactions, this strategy silently no-ops and the
> other three strategies still run.

### Strategy 3 – Trending posts (`_addTrendingRecs`)

1. Query posts from the last `TRENDING_WINDOW_DAYS` (default 7) days, `visibility: "public"`, not own.
2. Sort by `reactionCount DESC, viewCount DESC`, limit 30.
3. For each post at list position `index` (0-based):
   ```
   recencyDecay    = 1 / (index + 1)
   engagementScore = reactionCount × REACTION_WEIGHT + viewCount × VIEW_WEIGHT
   score           = engagementScore × recencyDecay
   ```
   Constants: `REACTION_WEIGHT = 2`, `VIEW_WEIGHT = 0.5`.

### Strategy 4 – Follow network (`_addFollowNetworkRecs`)

1. Query `Follow` collection: `followerId: userId` → get `followeeIds`.
2. Fetch recent posts from those users (`visibility: "public" | "followers"`, `sort: createdAt DESC`, limit 40).
3. Score each hit += `FOLLOW_SCORE` (default: `12`).

> This is the **strongest signal** because a deliberate follow is explicit intent.

---