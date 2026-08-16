const mongoose = require("mongoose");
const { app, request, registerUser, createPost, authHeader, Post } = require("./helpers/factories");
const { Tag, SearchIndex } = require("../models");

describe("POST /api/posts", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/posts").send({ content: "hi" });
    expect(res.status).toBe(401);
  });

  it("creates a post, upserts tags and the search index", async () => {
    const { user, token } = await registerUser();
    const res = await request(app)
      .post("/api/posts")
      .set(authHeader(token))
      .send({ content: "Dear you,", tags: ["Grief", "late-night"] });

    expect(res.status).toBe(201);
    expect(res.body.post).toMatchObject({
      authorId: user.id,
      content: "Dear you,",
      visibility: "public",
      isAnonymous: false,
      tagSlugs: ["grief", "late-night"],
    });

    const tags = await Tag.find({}).sort({ slug: 1 });
    expect(tags.map((t) => [t.slug, t.usageCount])).toEqual([
      ["grief", 1],
      ["late-night", 1],
    ]);

    const idx = await SearchIndex.findOne({ postId: res.body.post._id });
    expect(idx).not.toBeNull();
    expect(idx.authorUsername).toBe(user.username);
  });

  it("maps visibility 'anonymous' to a public anonymous post", async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post("/api/posts")
      .set(authHeader(token))
      .send({ content: "secret", visibility: "anonymous" });
    expect(res.status).toBe(201);
    expect(res.body.post.visibility).toBe("public");
    expect(res.body.post.isAnonymous).toBe(true);
  });

  it("rejects invalid payloads", async () => {
    const { token } = await registerUser();
    const empty = await request(app)
      .post("/api/posts")
      .set(authHeader(token))
      .send({ content: "" });
    expect(empty.status).toBe(400);
    const badTag = await request(app)
      .post("/api/posts")
      .set(authHeader(token))
      .send({ content: "x", tags: ["bad tag!"] });
    expect(badTag.status).toBe(400);
  });
});

describe("GET /api/posts/:id", () => {
  it("returns a public post to anonymous visitors and increments viewCount", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app).get(`/api/posts/${post._id}`);
    expect(res.status).toBe(200);
    expect(res.body.post.content).toBe("An unsent letter.");
    expect(res.body.post.authorId.username).toBe(user.username);

    // viewCount is bumped fire-and-forget; give it a tick.
    await new Promise((r) => setTimeout(r, 50));
    const fresh = await Post.findById(post._id);
    expect(fresh.viewCount).toBe(1);
  });

  it("hides the author of an anonymous post from everyone except the owner", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const post = await createPost(owner.user.id, { isAnonymous: true });

    const asOther = await request(app).get(`/api/posts/${post._id}`).set(authHeader(other.token));
    expect(asOther.body.post.authorId).toBeNull();

    const asOwner = await request(app).get(`/api/posts/${post._id}`).set(authHeader(owner.token));
    expect(asOwner.body.post.authorId.username).toBe(owner.user.username);
  });

  it("returns 403 for a private post unless requested by its owner", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const post = await createPost(owner.user.id, { visibility: "private" });

    expect((await request(app).get(`/api/posts/${post._id}`)).status).toBe(403);
    expect(
      (await request(app).get(`/api/posts/${post._id}`).set(authHeader(other.token))).status
    ).toBe(403);
    expect(
      (await request(app).get(`/api/posts/${post._id}`).set(authHeader(owner.token))).status
    ).toBe(200);
  });

  it("returns 404 for a missing post and 400 for a malformed id", async () => {
    const missing = await request(app).get(`/api/posts/${new mongoose.Types.ObjectId()}`);
    expect(missing.status).toBe(404);
    const malformed = await request(app).get("/api/posts/not-an-id");
    expect(malformed.status).toBe(400);
  });
});

describe("PUT /api/posts/:id", () => {
  it("lets the author edit content and visibility", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app)
      .put(`/api/posts/${post._id}`)
      .set(authHeader(token))
      .send({ content: "edited", visibility: "private" });
    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ content: "edited", visibility: "private" });
  });

  it("returns 403 when someone else tries to edit", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const post = await createPost(owner.user.id);

    const res = await request(app)
      .put(`/api/posts/${post._id}`)
      .set(authHeader(other.token))
      .send({ content: "hijacked" });
    expect(res.status).toBe(403);
    expect((await Post.findById(post._id)).content).toBe("An unsent letter.");
  });
});

describe("DELETE /api/posts/:id", () => {
  it("lets the author delete and cleans up the search index", async () => {
    const { token } = await registerUser();
    const created = await request(app)
      .post("/api/posts")
      .set(authHeader(token))
      .send({ content: "bye" });
    const id = created.body.post._id;

    const res = await request(app).delete(`/api/posts/${id}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(await Post.findById(id)).toBeNull();
    expect(await SearchIndex.findOne({ postId: id })).toBeNull();
  });

  it("returns 403 for non-owners", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const post = await createPost(owner.user.id);
    const res = await request(app).delete(`/api/posts/${post._id}`).set(authHeader(other.token));
    expect(res.status).toBe(403);
    expect(await Post.findById(post._id)).not.toBeNull();
  });
});

describe("comments", () => {
  it("adds a comment and returns the populated post", async () => {
    const owner = await registerUser();
    const commenter = await registerUser();
    const post = await createPost(owner.user.id);

    const res = await request(app)
      .post(`/api/posts/${post._id}/comments`)
      .set(authHeader(commenter.token))
      .send({ text: "same." });
    expect(res.status).toBe(200);
    expect(res.body.post.comments).toHaveLength(1);
    expect(res.body.post.comments[0].userId.username).toBe(commenter.user.username);
  });

  it("rejects an empty comment", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);
    const res = await request(app)
      .post(`/api/posts/${post._id}/comments`)
      .set(authHeader(token))
      .send({});
    expect(res.status).toBe(400);
  });

  it("masks anonymous commenters from third parties but not from the post owner", async () => {
    const owner = await registerUser();
    const commenter = await registerUser();
    const stranger = await registerUser();
    const post = await createPost(owner.user.id);

    await request(app)
      .post(`/api/posts/${post._id}/comments`)
      .set(authHeader(commenter.token))
      .send({ text: "anon", isAnonymous: true });

    const asStranger = await request(app)
      .get(`/api/posts/${post._id}`)
      .set(authHeader(stranger.token));
    expect(asStranger.body.post.comments[0].userId).toBeNull();

    const asOwner = await request(app).get(`/api/posts/${post._id}`).set(authHeader(owner.token));
    expect(asOwner.body.post.comments[0].userId.username).toBe(commenter.user.username);
  });

  it("only the comment author or post owner can delete a comment", async () => {
    const owner = await registerUser();
    const commenter = await registerUser();
    const stranger = await registerUser();
    const post = await createPost(owner.user.id);

    const added = await request(app)
      .post(`/api/posts/${post._id}/comments`)
      .set(authHeader(commenter.token))
      .send({ text: "hi" });
    const commentId = added.body.post.comments[0]._id;

    const url = `/api/posts/${post._id}/comments/${commentId}`;
    expect((await request(app).delete(url).set(authHeader(stranger.token))).status).toBe(403);
    expect((await request(app).delete(url).set(authHeader(owner.token))).status).toBe(200);
    expect((await Post.findById(post._id)).comments).toHaveLength(0);
  });
});
