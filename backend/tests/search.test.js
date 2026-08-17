const { app, request, registerUser, authHeader, Post } = require("./helpers/factories");
const { SearchIndex, Tag } = require("../models");

/**
 * Posts must be published through the API: the controller filters the
 * SearchIndex, and only the create-post path stamps `authorUsername` on it.
 */
const publishPost = async (token, body) => {
  const res = await request(app).post("/api/posts").set(authHeader(token)).send(body);
  expect(res.status).toBe(201);
  return res.body.post;
};

describe("GET /api/search", () => {
  it("returns empty result sets when no query parameter is given", async () => {
    const res = await request(app).get("/api/search");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "success",
      results: 0,
      posts: [],
      users: [],
      tags: [],
    });
  });

  it("finds public posts by their text and leaves non-public ones out", async () => {
    const { user, token } = await registerUser();
    await publishPost(token, { content: "the lighthouse keeper waits" });
    await publishPost(token, { content: "another lighthouse letter" });
    await publishPost(token, { content: "lighthouse secret", visibility: "private" });
    await publishPost(token, { content: "lighthouse circle", visibility: "followers" });
    await publishPost(token, { content: "nothing to do with the sea" });

    const res = await request(app).get("/api/search").query({ q: "lighthouse" });
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p) => p.content).sort()).toEqual([
      "another lighthouse letter",
      "the lighthouse keeper waits",
    ]);
    expect(res.body).toMatchObject({ results: 2, total: 2, page: 1, pages: 1 });
    expect(res.body.posts[0].authorId.username).toBe(user.username);
  });

  it("filters by tag slug, ignoring the casing the caller used", async () => {
    const { token } = await registerUser();
    await publishPost(token, { content: "tagged letter", tags: ["Grief"] });
    await publishPost(token, { content: "untagged letter" });

    const res = await request(app).get("/api/search").query({ tag: "GRIEF" });
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p) => p.content)).toEqual(["tagged letter"]);
    expect(res.body.tags.map((t) => t.slug)).toEqual(["grief"]);
    expect(res.body.users).toEqual([]);
  });

  it("filters by author username as a case-insensitive exact match", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await publishPost(a.token, { content: "mine" });
    await publishPost(b.token, { content: "theirs" });

    const res = await request(app)
      .get("/api/search")
      .query({ user: a.user.username.toUpperCase() });
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p) => p.content)).toEqual(["mine"]);
    expect(res.body.total).toBe(1);

    const partial = await request(app)
      .get("/api/search")
      .query({ user: a.user.username.slice(0, 4) });
    expect(partial.body.posts).toEqual([]);
  });

  it("combines a text query with an author filter", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await publishPost(a.token, { content: "shared lighthouse" });
    await publishPost(b.token, { content: "shared lighthouse" });
    await publishPost(b.token, { content: "unrelated" });

    const res = await request(app)
      .get("/api/search")
      .query({ q: "lighthouse", user: b.user.username });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.posts[0].authorId.username).toBe(b.user.username);
  });

  it("matches users by username fragment and by display name", async () => {
    const { user, token } = await registerUser();
    const other = await registerUser();
    await request(app)
      .put(`/api/users/${other.user.id}`)
      .set(authHeader(other.token))
      .send({ profile: { displayName: "Lighthouse Fan" } });
    await publishPost(token, { content: "lighthouse" });

    const byDisplayName = await request(app).get("/api/search").query({ q: "lighthouse" });
    expect(byDisplayName.body.users.map((u) => u.username)).toEqual([other.user.username]);

    const byUsername = await request(app)
      .get("/api/search")
      .query({ q: user.username.slice(0, 8) });
    expect(byUsername.body.users.map((u) => u.username)).toContain(user.username);
    expect(byUsername.body.users[0].email).toBeUndefined();
  });

  it("returns matching tags ordered by usage count", async () => {
    const { token } = await registerUser();
    await publishPost(token, { content: "letters" });
    await Tag.insertMany([
      { name: "Late Nights", slug: "late-nights", usageCount: 2 },
      { name: "Late Letters", slug: "late-letters", usageCount: 30 },
      { name: "Morning", slug: "morning", usageCount: 99 },
    ]);

    const res = await request(app).get("/api/search").query({ q: "late" });
    expect(res.status).toBe(200);
    expect(res.body.tags.map((t) => t.slug)).toEqual(["late-letters", "late-nights"]);
  });

  it("masks anonymous authors for everyone but the author", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await publishPost(owner.token, { content: "anonymous lighthouse", visibility: "anonymous" });

    const asVisitor = await request(app).get("/api/search").query({ q: "lighthouse" });
    expect(asVisitor.body.posts).toHaveLength(1);
    expect(asVisitor.body.posts[0].authorId).toBeNull();

    const asOther = await request(app)
      .get("/api/search")
      .query({ q: "lighthouse" })
      .set(authHeader(other.token));
    expect(asOther.body.posts[0].authorId).toBeNull();

    const asOwner = await request(app)
      .get("/api/search")
      .query({ q: "lighthouse" })
      .set(authHeader(owner.token));
    expect(asOwner.body.posts[0].authorId.username).toBe(owner.user.username);
  });

  it("paginates the post hits", async () => {
    const { token } = await registerUser();
    await publishPost(token, { content: "lighthouse one" });
    await publishPost(token, { content: "lighthouse two" });
    await publishPost(token, { content: "lighthouse three" });

    const page1 = await request(app).get("/api/search").query({ q: "lighthouse", limit: 2 });
    expect(page1.body).toMatchObject({ results: 2, total: 3, page: 1, pages: 2 });

    const page2 = await request(app)
      .get("/api/search")
      .query({ q: "lighthouse", limit: 2, page: 2 });
    expect(page2.body).toMatchObject({ results: 1, total: 3, page: 2, pages: 2 });

    const seen = [...page1.body.posts, ...page2.body.posts].map((p) => p.content).sort();
    expect(seen).toEqual(["lighthouse one", "lighthouse three", "lighthouse two"]);
  });

  it("skips index entries whose post no longer exists", async () => {
    const { token } = await registerUser();
    await publishPost(token, { content: "orphaned lighthouse" });
    // deleteMany bypasses the document-level cascade, leaving a stale index row.
    await Post.deleteMany({});
    expect(await SearchIndex.countDocuments({})).toBe(1);

    const res = await request(app).get("/api/search").query({ q: "lighthouse" });
    expect(res.status).toBe(200);
    expect(res.body.posts).toEqual([]);
    expect(res.body.results).toBe(0);
    expect(res.body.total).toBe(1);
  });

  it("treats regex metacharacters in the user filter literally, not as a pattern", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await publishPost(a.token, { content: "mine" });
    await publishPost(b.token, { content: "theirs" });

    // A wildcard must not enumerate every public post.
    const res = await request(app).get("/api/search").query({ user: ".*" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);

    // The exact username still matches.
    const exact = await request(app).get("/api/search").query({ user: a.user.username });
    expect(exact.body.total).toBe(1);
  });

  it("survives a query containing an invalid regular expression", async () => {
    for (const q of ["(", "[", "*", "a\\", "?"]) {
      const res = await request(app).get("/api/search").query({ q });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tags)).toBe(true);
    }
  });

  it("ignores an invalid token instead of rejecting the request", async () => {
    const { token } = await registerUser();
    await publishPost(token, { content: "anonymous lighthouse", visibility: "anonymous" });

    const res = await request(app)
      .get("/api/search")
      .query({ q: "lighthouse" })
      .set(authHeader("not-a-jwt"));
    expect(res.status).toBe(200);
    expect(res.body.posts[0].authorId).toBeNull();
  });
});
