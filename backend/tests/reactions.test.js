const { app, request, registerUser, createPost, authHeader, Post } = require("./helpers/factories");
const { Reaction } = require("../models");

const url = (postId) => `/api/posts/${postId}/reactions`;

describe("POST /api/posts/:id/reactions", () => {
  it("requires authentication", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);
    expect((await request(app).post(url(post._id)).send({ type: "like" })).status).toBe(401);
  });

  it("rejects an unknown reaction type", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);
    const res = await request(app).post(url(post._id)).set(authHeader(token)).send({ type: "yikes" });
    expect(res.status).toBe(400);
  });

  it("adds a reaction and increments reactionCount exactly once", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app).post(url(post._id)).set(authHeader(token)).send({ type: "love" });
    expect(res.status).toBe(201);
    expect(res.body.reaction).toMatchObject({ postId: String(post._id), userId: user.id, type: "love" });

    expect(await Reaction.countDocuments({ postId: post._id })).toBe(1);
    expect((await Post.findById(post._id)).reactionCount).toBe(1);
  });

  it("toggles the same reaction off on a second POST", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);

    await request(app).post(url(post._id)).set(authHeader(token)).send({ type: "like" });
    const second = await request(app).post(url(post._id)).set(authHeader(token)).send({ type: "like" });
    expect(second.status).toBe(200);
    expect(second.body.message).toMatch(/removed/i);

    expect(await Reaction.countDocuments({ postId: post._id })).toBe(0);
    expect((await Post.findById(post._id)).reactionCount).toBe(0);
  });

  it("allows different users and different types to stack", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const post = await createPost(a.user.id);

    await request(app).post(url(post._id)).set(authHeader(a.token)).send({ type: "like" });
    await request(app).post(url(post._id)).set(authHeader(a.token)).send({ type: "wow" });
    await request(app).post(url(post._id)).set(authHeader(b.token)).send({ type: "like" });

    expect((await Post.findById(post._id)).reactionCount).toBe(3);

    const summary = await request(app).get(url(post._id));
    expect(summary.status).toBe(200);
    expect(summary.body.reactions).toEqual({ like: 2, wow: 1 });
  });
});

describe("DELETE /api/posts/:id/reactions", () => {
  it("removes a reaction and decrements reactionCount", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);
    await request(app).post(url(post._id)).set(authHeader(token)).send({ type: "sad" });

    const res = await request(app).delete(url(post._id)).set(authHeader(token)).send({ type: "sad" });
    expect(res.status).toBe(200);
    expect(await Reaction.countDocuments({ postId: post._id })).toBe(0);
    expect((await Post.findById(post._id)).reactionCount).toBe(0);
  });

  it("returns 400 when there is nothing to remove", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);
    const res = await request(app).delete(url(post._id)).set(authHeader(token)).send({ type: "sad" });
    expect(res.status).toBe(400);
    expect((await Post.findById(post._id)).reactionCount).toBe(0);
  });
});
