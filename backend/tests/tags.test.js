const { app, request, registerUser, createPost, authHeader } = require("./helpers/factories");
const { Tag } = require("../models");

const seedTags = () =>
  Tag.insertMany([
    { name: "Ache", slug: "ache", category: "emotion", usageCount: 5 },
    { name: "Bloom", slug: "bloom", category: "creative", usageCount: 12 },
    { name: "Calm", slug: "calm", category: "wellness", usageCount: 1 },
    { name: "Dusk", slug: "dusk", category: "emotion", usageCount: 9 },
  ]);

describe("GET /api/tags", () => {
  it("lists every tag alphabetically with pagination metadata", async () => {
    await seedTags();

    const res = await request(app).get("/api/tags");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "success", results: 4, total: 4, page: 1, pages: 1 });
    expect(res.body.tags.map((t) => t.name)).toEqual(["Ache", "Bloom", "Calm", "Dusk"]);
    expect(res.body.tags[0]).toMatchObject({ slug: "ache", category: "emotion", usageCount: 5 });
  });

  it("filters by category", async () => {
    await seedTags();

    const res = await request(app).get("/api/tags").query({ category: "emotion" });
    expect(res.status).toBe(200);
    expect(res.body.tags.map((t) => t.slug)).toEqual(["ache", "dusk"]);
    expect(res.body).toMatchObject({ results: 2, total: 2 });
  });

  it("returns an empty list for a category no tag uses", async () => {
    await seedTags();

    const res = await request(app).get("/api/tags").query({ category: "nostalgia" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ results: 0, total: 0, pages: 0, tags: [] });
  });

  it("honours page and limit", async () => {
    await seedTags();

    const page1 = await request(app).get("/api/tags").query({ limit: 3 });
    expect(page1.body.tags.map((t) => t.slug)).toEqual(["ache", "bloom", "calm"]);
    expect(page1.body).toMatchObject({ results: 3, total: 4, page: 1, pages: 2 });

    const page2 = await request(app).get("/api/tags").query({ limit: 3, page: 2 });
    expect(page2.body.tags.map((t) => t.slug)).toEqual(["dusk"]);
    expect(page2.body).toMatchObject({ results: 1, total: 4, page: 2 });
  });

  it("is reachable without a token", async () => {
    const res = await request(app).get("/api/tags");
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([]);
  });
});

describe("GET /api/tags/trending", () => {
  it("returns tags ordered by usage count, most used first", async () => {
    await seedTags();

    const res = await request(app).get("/api/tags/trending");
    expect(res.status).toBe(200);
    expect(res.body.tags.map((t) => t.slug)).toEqual(["bloom", "dusk", "ache", "calm"]);
  });

  it("caps the list at twenty tags", async () => {
    await Tag.insertMany(
      Array.from({ length: 25 }, (_, i) => ({
        name: `Tag ${String(i).padStart(2, "0")}`,
        slug: `tag-${String(i).padStart(2, "0")}`,
        usageCount: i,
      }))
    );

    const res = await request(app).get("/api/tags/trending");
    expect(res.body.tags).toHaveLength(20);
    expect(res.body.tags[0].slug).toBe("tag-24");
    expect(res.body.tags[19].slug).toBe("tag-05");
  });
});

describe("GET /api/tags/:slug/posts", () => {
  it("returns only public posts carrying the tag, newest first", async () => {
    const { user } = await registerUser();
    const first = await createPost(user.id, { content: "first grief", tagSlugs: ["grief"] });
    await createPost(user.id, {
      content: "second grief",
      tagSlugs: ["grief"],
      createdAt: new Date(first.createdAt.getTime() + 1000),
    });
    await createPost(user.id, {
      content: "private grief",
      tagSlugs: ["grief"],
      visibility: "private",
    });
    await createPost(user.id, {
      content: "followers grief",
      tagSlugs: ["grief"],
      visibility: "followers",
    });
    await createPost(user.id, { content: "other tag", tagSlugs: ["joy"] });

    const res = await request(app).get("/api/tags/grief/posts");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p) => p.content)).toEqual(["second grief", "first grief"]);
    expect(res.body).toMatchObject({ results: 2, total: 2, page: 1, pages: 1 });
    expect(res.body.posts[0].authorId.username).toBe(user.username);
  });

  it("masks the author of anonymous posts for everyone but the author", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await createPost(owner.user.id, { tagSlugs: ["grief"], isAnonymous: true });

    const asVisitor = await request(app).get("/api/tags/grief/posts");
    expect(asVisitor.body.posts[0].authorId).toBeNull();

    const asOther = await request(app).get("/api/tags/grief/posts").set(authHeader(other.token));
    expect(asOther.body.posts[0].authorId).toBeNull();

    const asOwner = await request(app).get("/api/tags/grief/posts").set(authHeader(owner.token));
    expect(asOwner.body.posts[0].authorId.username).toBe(owner.user.username);
  });

  it("returns an empty result set instead of 404 for a slug nobody used", async () => {
    const res = await request(app).get("/api/tags/never-used/posts");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ results: 0, total: 0, pages: 0, posts: [] });
  });

  // NOTE: getPostsByTag uses req.params.slug verbatim, unlike searchController which
  // lowercases the tag filter. Stored slugs are always lowercase, so a capitalised
  // slug in the URL silently matches nothing. Asserting today's behaviour.
  it("does not match a slug whose casing differs from the stored slug", async () => {
    const { user } = await registerUser();
    await createPost(user.id, { tagSlugs: ["grief"] });

    const res = await request(app).get("/api/tags/Grief/posts");
    expect(res.status).toBe(200);
    expect(res.body.posts).toEqual([]);
  });

  it("paginates tagged posts", async () => {
    const { user } = await registerUser();
    const base = await createPost(user.id, { content: "p1", tagSlugs: ["grief"] });
    await createPost(user.id, {
      content: "p2",
      tagSlugs: ["grief"],
      createdAt: new Date(base.createdAt.getTime() + 1000),
    });
    await createPost(user.id, {
      content: "p3",
      tagSlugs: ["grief"],
      createdAt: new Date(base.createdAt.getTime() + 2000),
    });

    const page1 = await request(app).get("/api/tags/grief/posts").query({ limit: 2 });
    expect(page1.body.posts.map((p) => p.content)).toEqual(["p3", "p2"]);
    expect(page1.body).toMatchObject({ results: 2, total: 3, page: 1, pages: 2 });

    const page2 = await request(app).get("/api/tags/grief/posts").query({ limit: 2, page: 2 });
    expect(page2.body.posts.map((p) => p.content)).toEqual(["p1"]);
    expect(page2.body).toMatchObject({ results: 1, page: 2 });
  });
});
