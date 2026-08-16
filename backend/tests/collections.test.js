const { app, request, registerUser, createPost, authHeader, Post } = require("./helpers/factories");
const { Collection } = require("../models");

const createCollection = async (token, body = {}) => {
  const res = await request(app)
    .post("/api/collections")
    .set(authHeader(token))
    .send({ name: "Keepsakes", ...body });
  expect(res.status).toBe(201);
  return res.body.collection;
};

describe("POST /api/collections", () => {
  it("creates a private collection by default", async () => {
    const { user, token } = await registerUser();
    const col = await createCollection(token);
    expect(col).toMatchObject({ ownerId: user.id, name: "Keepsakes", visibility: "private" });
    expect(col.postCount).toBe(0);
  });

  it("validates the payload", async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post("/api/collections")
      .set(authHeader(token))
      .send({ name: "", visibility: "followers" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/collections/:id", () => {
  it("hides private collections from non-owners", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const col = await createCollection(owner.token);

    expect((await request(app).get(`/api/collections/${col._id}`)).status).toBe(403);
    expect(
      (await request(app).get(`/api/collections/${col._id}`).set(authHeader(other.token))).status
    ).toBe(403);
    const mine = await request(app).get(`/api/collections/${col._id}`).set(authHeader(owner.token));
    expect(mine.status).toBe(200);
    expect(mine.body.collection.ownerId.username).toBe(owner.user.username);
  });

  it("returns public collections with populated posts, masking anonymous authors", async () => {
    const owner = await registerUser();
    const col = await createCollection(owner.token, { visibility: "public" });
    const post = await createPost(owner.user.id, { isAnonymous: true });
    await request(app)
      .post(`/api/collections/${col._id}/posts`)
      .set(authHeader(owner.token))
      .send({ postId: post._id });

    const res = await request(app).get(`/api/collections/${col._id}`);
    expect(res.status).toBe(200);
    expect(res.body.collection.postIds).toHaveLength(1);
    expect(res.body.collection.postIds[0].content).toBe("An unsent letter.");
    expect(res.body.collection.postIds[0].authorId).toBeNull();
  });
});

describe("PUT / DELETE /api/collections/:id", () => {
  it("only the owner can update or delete", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const col = await createCollection(owner.token);

    const upd = await request(app)
      .put(`/api/collections/${col._id}`)
      .set(authHeader(other.token))
      .send({ name: "stolen" });
    expect(upd.status).toBe(403);

    const del = await request(app)
      .delete(`/api/collections/${col._id}`)
      .set(authHeader(other.token));
    expect(del.status).toBe(403);

    const ok = await request(app)
      .put(`/api/collections/${col._id}`)
      .set(authHeader(owner.token))
      .send({ name: "Renamed", visibility: "public" });
    expect(ok.status).toBe(200);
    expect(ok.body.collection).toMatchObject({ name: "Renamed", visibility: "public" });

    const gone = await request(app)
      .delete(`/api/collections/${col._id}`)
      .set(authHeader(owner.token));
    expect(gone.status).toBe(200);
    expect(await Collection.findById(col._id)).toBeNull();
  });
});

describe("collection posts", () => {
  it("adds and removes a post, keeping postCount and Post.saveCount in sync", async () => {
    const owner = await registerUser();
    const col = await createCollection(owner.token);
    const post = await createPost(owner.user.id);

    const add = await request(app)
      .post(`/api/collections/${col._id}/posts`)
      .set(authHeader(owner.token))
      .send({ postId: post._id });
    expect(add.status).toBe(200);
    expect((await Collection.findById(col._id)).postCount).toBe(1);
    expect((await Post.findById(post._id)).saveCount).toBe(1);

    const dup = await request(app)
      .post(`/api/collections/${col._id}/posts`)
      .set(authHeader(owner.token))
      .send({ postId: post._id });
    expect(dup.status).toBe(400);

    const rm = await request(app)
      .delete(`/api/collections/${col._id}/posts/${post._id}`)
      .set(authHeader(owner.token));
    expect(rm.status).toBe(200);
    expect((await Collection.findById(col._id)).postCount).toBe(0);
    expect((await Post.findById(post._id)).saveCount).toBe(0);

    const rmAgain = await request(app)
      .delete(`/api/collections/${col._id}/posts/${post._id}`)
      .set(authHeader(owner.token));
    expect(rmAgain.status).toBe(400);
  });

  it("refuses to save someone else's private post, and 403s non-owners", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const col = await createCollection(owner.token);
    const privatePost = await createPost(other.user.id, { visibility: "private" });
    const publicPost = await createPost(other.user.id);

    const priv = await request(app)
      .post(`/api/collections/${col._id}/posts`)
      .set(authHeader(owner.token))
      .send({ postId: privatePost._id });
    expect(priv.status).toBe(403);

    const notMine = await request(app)
      .post(`/api/collections/${col._id}/posts`)
      .set(authHeader(other.token))
      .send({ postId: publicPost._id });
    expect(notMine.status).toBe(403);

    const missing = await request(app)
      .post(`/api/collections/${col._id}/posts`)
      .set(authHeader(owner.token))
      .send({});
    expect(missing.status).toBe(400);
  });
});
