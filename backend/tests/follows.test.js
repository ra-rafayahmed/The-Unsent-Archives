const mongoose = require("mongoose");
const { app, request, registerUser, authHeader } = require("./helpers/factories");
const { Follow } = require("../models");

describe("POST /api/users/:id/follow", () => {
  it("creates a follow edge and reports status", async () => {
    const a = await registerUser();
    const b = await registerUser();

    const res = await request(app).post(`/api/users/${b.user.id}/follow`).set(authHeader(a.token));
    expect(res.status).toBe(201);
    expect(await Follow.countDocuments({ followerId: a.user.id, followeeId: b.user.id })).toBe(1);

    const status = await request(app)
      .get(`/api/users/${b.user.id}/follow/status`)
      .set(authHeader(a.token));
    expect(status.body.isFollowing).toBe(true);

    const reverse = await request(app)
      .get(`/api/users/${a.user.id}/follow/status`)
      .set(authHeader(b.token));
    expect(reverse.body.isFollowing).toBe(false);
  });

  it("rejects following yourself, unknown users, and duplicates", async () => {
    const a = await registerUser();
    const b = await registerUser();

    const self = await request(app).post(`/api/users/${a.user.id}/follow`).set(authHeader(a.token));
    expect(self.status).toBe(400);

    const ghost = await request(app)
      .post(`/api/users/${new mongoose.Types.ObjectId()}/follow`)
      .set(authHeader(a.token));
    expect(ghost.status).toBe(404);

    await request(app).post(`/api/users/${b.user.id}/follow`).set(authHeader(a.token));
    const dup = await request(app).post(`/api/users/${b.user.id}/follow`).set(authHeader(a.token));
    expect(dup.status).toBe(409);
  });

  it("requires authentication", async () => {
    const b = await registerUser();
    expect((await request(app).post(`/api/users/${b.user.id}/follow`)).status).toBe(401);
  });
});

describe("DELETE /api/users/:id/follow", () => {
  it("removes the edge, and 400s when there was none", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await request(app).post(`/api/users/${b.user.id}/follow`).set(authHeader(a.token));

    const ok = await request(app).delete(`/api/users/${b.user.id}/follow`).set(authHeader(a.token));
    expect(ok.status).toBe(200);
    expect(await Follow.countDocuments({})).toBe(0);

    const again = await request(app)
      .delete(`/api/users/${b.user.id}/follow`)
      .set(authHeader(a.token));
    expect(again.status).toBe(400);
  });
});

describe("followers / following lists", () => {
  it("lists followers and following with user summaries", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const c = await registerUser();
    await request(app).post(`/api/users/${c.user.id}/follow`).set(authHeader(a.token));
    await request(app).post(`/api/users/${c.user.id}/follow`).set(authHeader(b.token));
    await request(app).post(`/api/users/${a.user.id}/follow`).set(authHeader(c.token));

    const followers = await request(app).get(`/api/users/${c.user.id}/followers`);
    expect(followers.status).toBe(200);
    const followerNames = followers.body.followers.map((f) => f.username).sort();
    expect(followerNames).toEqual([a.user.username, b.user.username].sort());

    const following = await request(app).get(`/api/users/${c.user.id}/following`);
    expect(following.status).toBe(200);
    expect(following.body.following.map((f) => f.username)).toEqual([a.user.username]);
  });
});

describe("global /api/follows routes (frontend-compatible)", () => {
  it("follows via body followeeId and lists my following", async () => {
    const a = await registerUser();
    const b = await registerUser();

    const res = await request(app)
      .post("/api/follows")
      .set(authHeader(a.token))
      .send({ followeeId: b.user.id });
    expect(res.status).toBe(201);

    const mine = await request(app).get("/api/follows/following").set(authHeader(a.token));
    expect(mine.status).toBe(200);
    expect(mine.body.following.map((u) => u.username)).toEqual([b.user.username]);

    const missing = await request(app).post("/api/follows").set(authHeader(a.token)).send({});
    expect(missing.status).toBe(400);
  });
});
