const { app, request, registerUser, createPost, authHeader } = require("./helpers/factories");

describe("GET /api/feed", () => {
  it("returns only public posts, newest first, with pagination metadata", async () => {
    const { user } = await registerUser();
    const older = await createPost(user.id, { content: "older" });
    await createPost(user.id, { content: "private", visibility: "private" });
    await createPost(user.id, { content: "followers", visibility: "followers" });
    // ensure a later createdAt for the second public post
    const newer = await createPost(user.id, {
      content: "newer",
      createdAt: new Date(older.createdAt.getTime() + 1000),
    });

    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p) => p.content)).toEqual(["newer", "older"]);
    expect(res.body).toMatchObject({ results: 2, total: 2, page: 1, pages: 1 });
    expect(String(res.body.posts[0]._id)).toBe(String(newer._id));
  });

  it("sorts by reactionCount when sort=popular and paginates", async () => {
    const { user } = await registerUser();
    await createPost(user.id, { content: "meh", reactionCount: 1 });
    await createPost(user.id, { content: "hit", reactionCount: 50 });
    await createPost(user.id, { content: "ok", reactionCount: 5 });

    const res = await request(app).get("/api/feed").query({ sort: "popular", limit: 2 });
    expect(res.body.posts.map((p) => p.content)).toEqual(["hit", "ok"]);
    expect(res.body).toMatchObject({ results: 2, total: 3, page: 1, pages: 2 });

    const page2 = await request(app).get("/api/feed").query({ sort: "popular", limit: 2, page: 2 });
    expect(page2.body.posts.map((p) => p.content)).toEqual(["meh"]);
  });

  it("masks anonymous authors for everyone but the author", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await createPost(owner.user.id, { isAnonymous: true });

    const anon = await request(app).get("/api/feed");
    expect(anon.body.posts[0].authorId).toBeNull();

    const asOther = await request(app).get("/api/feed").set(authHeader(other.token));
    expect(asOther.body.posts[0].authorId).toBeNull();

    const asOwner = await request(app).get("/api/feed").set(authHeader(owner.token));
    expect(asOwner.body.posts[0].authorId.username).toBe(owner.user.username);
  });
});

describe("GET /api/feed/following", () => {
  it("requires auth", async () => {
    expect((await request(app).get("/api/feed/following")).status).toBe(401);
  });

  it("returns posts from followed users plus my own, excluding private ones", async () => {
    const me = await registerUser();
    const followed = await registerUser();
    const stranger = await registerUser();

    await request(app).post(`/api/users/${followed.user.id}/follow`).set(authHeader(me.token));

    await createPost(me.user.id, { content: "mine" });
    await createPost(followed.user.id, { content: "theirs-public" });
    await createPost(followed.user.id, { content: "theirs-followers", visibility: "followers" });
    await createPost(followed.user.id, { content: "theirs-private", visibility: "private" });
    await createPost(stranger.user.id, { content: "stranger" });

    const res = await request(app).get("/api/feed/following").set(authHeader(me.token));
    expect(res.status).toBe(200);
    const contents = res.body.posts.map((p) => p.content).sort();
    expect(contents).toEqual(["mine", "theirs-followers", "theirs-public"]);
  });
});

describe("GET /api/feed/trending", () => {
  it("returns recent public posts ordered by reactions and ignores old posts", async () => {
    const { user } = await registerUser();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await createPost(user.id, { content: "old-hit", reactionCount: 999, createdAt: tenDaysAgo });
    await createPost(user.id, { content: "warm", reactionCount: 3 });
    await createPost(user.id, { content: "hot", reactionCount: 30 });
    await createPost(user.id, { content: "secret-hot", reactionCount: 100, visibility: "private" });

    const res = await request(app).get("/api/feed/trending");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p) => p.content)).toEqual(["hot", "warm"]);
  });
});
