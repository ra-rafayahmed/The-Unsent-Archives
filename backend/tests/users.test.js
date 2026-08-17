const mongoose = require("mongoose");
const { app, request, registerUser, createPost, authHeader, User } = require("./helpers/factories");
const { Collection, Follow, Tag } = require("../models");

describe("GET /api/users/:id", () => {
  it("returns a public profile with follower and following counts", async () => {
    const subject = await registerUser();
    const fanA = await registerUser();
    const fanB = await registerUser();

    await Follow.create([
      { followerId: fanA.user.id, followeeId: subject.user.id },
      { followerId: fanB.user.id, followeeId: subject.user.id },
      { followerId: subject.user.id, followeeId: fanA.user.id },
    ]);

    const res = await request(app).get(`/api/users/${subject.user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      _id: subject.user.id,
      username: subject.user.username,
      followerCount: 2,
      followingCount: 1,
    });
  });

  it("publishes only public profile fields", async () => {
    const { user } = await registerUser();
    // Moderation state must not be discoverable by anyone who knows an id.
    await User.findByIdAndUpdate(user.id, { reportCount: 3, isSuspended: true, role: "admin" });

    const res = await request(app).get(`/api/users/${user.id}`);
    expect(res.status).toBe(200);
    const allowed = [
      "_id",
      "username",
      "avatarUrl",
      "bio",
      "profile",
      "tagInterests",
      "createdAt",
      "followerCount",
      "followingCount",
    ];
    // No key may appear that is not deliberately published.
    expect(Object.keys(res.body.user).filter((k) => !allowed.includes(k))).toEqual([]);
    for (const leaked of [
      "email",
      "isActive",
      "passwordHash",
      "backupCodes",
      "role",
      "reportCount",
      "isSuspended",
      "passwordResetTokenHash",
    ]) {
      expect(res.body.user[leaked]).toBeUndefined();
    }
  });

  it("populates tag interests with their name and slug", async () => {
    const { user, token } = await registerUser();
    const tag = await Tag.create({ name: "Grief", slug: "grief", category: "emotion" });
    await request(app)
      .put(`/api/users/${user.id}`)
      .set(authHeader(token))
      .send({ tagInterests: [tag._id] });

    const res = await request(app).get(`/api/users/${user.id}`);
    expect(res.body.user.tagInterests).toEqual([
      { _id: String(tag._id), name: "Grief", slug: "grief" },
    ]);
  });

  it("returns 404 for an unknown user and 400 for a malformed id", async () => {
    const missing = await request(app).get(`/api/users/${new mongoose.Types.ObjectId()}`);
    expect(missing.status).toBe(404);
    const malformed = await request(app).get("/api/users/not-an-id");
    expect(malformed.status).toBe(400);
  });
});

describe("PUT /api/users/:id", () => {
  it("requires authentication", async () => {
    const { user } = await registerUser();
    const res = await request(app).put(`/api/users/${user.id}`).send({ bio: "hi" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when editing someone else's profile", async () => {
    const owner = await registerUser();
    const other = await registerUser();

    const res = await request(app)
      .put(`/api/users/${owner.user.id}`)
      .set(authHeader(other.token))
      .send({ bio: "hijacked" });
    expect(res.status).toBe(403);
    expect((await User.findById(owner.user.id)).bio).toBe("");
  });

  it("lets the owner update bio, avatar and profile details", async () => {
    const { user, token } = await registerUser();
    const tag = await Tag.create({ name: "Nostalgia", slug: "nostalgia" });

    const res = await request(app)
      .put(`/api/users/${user.id}`)
      .set(authHeader(token))
      .send({
        bio: "Still writing letters.",
        avatarUrl: "https://example.com/a.png",
        profile: { displayName: "Dee", location: "Lahore" },
        tagInterests: [tag._id],
      });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      bio: "Still writing letters.",
      avatarUrl: "https://example.com/a.png",
      profile: { displayName: "Dee", location: "Lahore" },
    });
    expect(res.body.user.tagInterests).toEqual([
      { _id: String(tag._id), name: "Nostalgia", slug: "nostalgia" },
    ]);

    const stored = await User.findById(user.id);
    expect(stored.bio).toBe("Still writing letters.");
    expect(stored.profile.displayName).toBe("Dee");
    expect(stored.tagInterests.map(String)).toEqual([String(tag._id)]);
  });

  it("ignores fields that are not on the allow-list", async () => {
    const { user, token } = await registerUser();

    const res = await request(app).put(`/api/users/${user.id}`).set(authHeader(token)).send({
      bio: "legit",
      username: "takeover",
      email: "takeover@example.com",
      role: "admin",
      isSuspended: true,
    });
    expect(res.status).toBe(200);

    const stored = await User.findById(user.id);
    expect(stored.bio).toBe("legit");
    expect(stored.username).toBe(user.username);
    expect(stored.email).toBe(user.email);
    expect(stored.role).toBe("user");
    expect(stored.isSuspended).toBe(false);
  });

  it("returns 400 when an update fails schema validation", async () => {
    const { user, token } = await registerUser();

    const tooLong = await request(app)
      .put(`/api/users/${user.id}`)
      .set(authHeader(token))
      .send({ bio: "x".repeat(301) });
    expect(tooLong.status).toBe(400);

    const badRef = await request(app)
      .put(`/api/users/${user.id}`)
      .set(authHeader(token))
      .send({ tagInterests: ["not-an-object-id"] });
    expect(badRef.status).toBe(400);

    expect((await User.findById(user.id)).bio).toBe("");
  });

  it("returns the profile untouched when the body carries no updatable fields", async () => {
    const { user, token } = await registerUser();
    const res = await request(app).put(`/api/users/${user.id}`).set(authHeader(token)).send({});
    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe("");
  });
});

describe("GET /api/users/:id/posts", () => {
  it("shows only public posts to visitors but every post to the author", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await createPost(owner.user.id, { content: "public" });
    await createPost(owner.user.id, { content: "followers", visibility: "followers" });
    await createPost(owner.user.id, { content: "private", visibility: "private" });

    const asVisitor = await request(app).get(`/api/users/${owner.user.id}/posts`);
    expect(asVisitor.status).toBe(200);
    expect(asVisitor.body.posts.map((p) => p.content)).toEqual(["public"]);
    expect(asVisitor.body).toMatchObject({ results: 1, total: 1, page: 1, pages: 1 });

    const asOther = await request(app)
      .get(`/api/users/${owner.user.id}/posts`)
      .set(authHeader(other.token));
    expect(asOther.body.posts.map((p) => p.content)).toEqual(["public"]);

    const asOwner = await request(app)
      .get(`/api/users/${owner.user.id}/posts`)
      .set(authHeader(owner.token));
    expect(asOwner.body.total).toBe(3);
    expect(asOwner.body.posts.map((p) => p.content).sort()).toEqual([
      "followers",
      "private",
      "public",
    ]);
  });

  it("masks the author of anonymous posts for everyone but the author", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await createPost(owner.user.id, { isAnonymous: true });

    const asVisitor = await request(app).get(`/api/users/${owner.user.id}/posts`);
    expect(asVisitor.body.posts[0].authorId).toBeNull();

    const asOther = await request(app)
      .get(`/api/users/${owner.user.id}/posts`)
      .set(authHeader(other.token));
    expect(asOther.body.posts[0].authorId).toBeNull();

    const asOwner = await request(app)
      .get(`/api/users/${owner.user.id}/posts`)
      .set(authHeader(owner.token));
    expect(asOwner.body.posts[0].authorId.username).toBe(owner.user.username);
  });

  it("returns newest posts first and paginates", async () => {
    const { user } = await registerUser();
    const first = await createPost(user.id, { content: "first" });
    await createPost(user.id, {
      content: "second",
      createdAt: new Date(first.createdAt.getTime() + 1000),
    });
    await createPost(user.id, {
      content: "third",
      createdAt: new Date(first.createdAt.getTime() + 2000),
    });

    const page1 = await request(app).get(`/api/users/${user.id}/posts`).query({ limit: 2 });
    expect(page1.body.posts.map((p) => p.content)).toEqual(["third", "second"]);
    expect(page1.body).toMatchObject({ results: 2, total: 3, page: 1, pages: 2 });

    const page2 = await request(app)
      .get(`/api/users/${user.id}/posts`)
      .query({ limit: 2, page: 2 });
    expect(page2.body.posts.map((p) => p.content)).toEqual(["first"]);
    expect(page2.body).toMatchObject({ results: 1, total: 3, page: 2 });
  });

  it("returns an empty result set for a user who has never posted", async () => {
    const { user } = await registerUser();
    const res = await request(app).get(`/api/users/${user.id}/posts`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ results: 0, total: 0, pages: 0, posts: [] });
  });
});

describe("GET /api/users/:id/collections", () => {
  it("shows only public collections to visitors but every collection to the owner", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await Collection.create([
      { ownerId: owner.user.id, name: "Shared", visibility: "public" },
      { ownerId: owner.user.id, name: "Hidden", visibility: "private" },
    ]);

    const asVisitor = await request(app).get(`/api/users/${owner.user.id}/collections`);
    expect(asVisitor.status).toBe(200);
    expect(asVisitor.body.collections.map((c) => c.name)).toEqual(["Shared"]);
    expect(asVisitor.body).toMatchObject({ results: 1, total: 1, page: 1, pages: 1 });

    const asOther = await request(app)
      .get(`/api/users/${owner.user.id}/collections`)
      .set(authHeader(other.token));
    expect(asOther.body.collections.map((c) => c.name)).toEqual(["Shared"]);

    const asOwner = await request(app)
      .get(`/api/users/${owner.user.id}/collections`)
      .set(authHeader(owner.token));
    expect(asOwner.body.total).toBe(2);
    expect(asOwner.body.collections.map((c) => c.name).sort()).toEqual(["Hidden", "Shared"]);
  });

  it("previews at most four posts per collection and omits their authors", async () => {
    const owner = await registerUser();
    const posts = [];
    for (let i = 0; i < 5; i++) {
      posts.push(await createPost(owner.user.id, { content: `letter ${i}` }));
    }
    await Collection.create({
      ownerId: owner.user.id,
      name: "Keepsakes",
      visibility: "public",
      postIds: posts.map((p) => p._id),
      postCount: posts.length,
    });

    const res = await request(app).get(`/api/users/${owner.user.id}/collections`);
    expect(res.status).toBe(200);
    const [collection] = res.body.collections;
    expect(collection.postCount).toBe(5);
    expect(collection.postIds).toHaveLength(4);
    expect(collection.postIds[0].content).toMatch(/^letter /);
    expect(collection.postIds[0].authorId).toBeUndefined();
  });

  it("paginates collections newest first", async () => {
    const owner = await registerUser();
    const older = await Collection.create({
      ownerId: owner.user.id,
      name: "Older",
      visibility: "public",
    });
    await Collection.create({
      ownerId: owner.user.id,
      name: "Newer",
      visibility: "public",
      createdAt: new Date(older.createdAt.getTime() + 1000),
    });

    const page1 = await request(app).get(`/api/users/${owner.user.id}/collections`).query({
      limit: 1,
    });
    expect(page1.body.collections.map((c) => c.name)).toEqual(["Newer"]);
    expect(page1.body).toMatchObject({ results: 1, total: 2, page: 1, pages: 2 });

    const page2 = await request(app)
      .get(`/api/users/${owner.user.id}/collections`)
      .query({ limit: 1, page: 2 });
    expect(page2.body.collections.map((c) => c.name)).toEqual(["Older"]);
  });
});
