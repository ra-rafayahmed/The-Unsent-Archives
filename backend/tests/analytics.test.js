const mongoose = require("mongoose");
const { app, request, registerUser, createPost, authHeader } = require("./helpers/factories");
const { AnalyticsEvent } = require("../models");

const logEvents = (postId, types) =>
  AnalyticsEvent.insertMany(types.map((eventType) => ({ postId, eventType })));

describe("POST /api/events", () => {
  it("records an event for a signed-in actor", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app)
      .post("/api/events")
      .set(authHeader(token))
      .send({
        postId: post._id,
        eventType: "click",
        metadata: { platform: "web", referer: "https://example.test" },
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "success", eventType: "click" });

    const stored = await AnalyticsEvent.findOne({ postId: post._id });
    expect(String(stored.actorId)).toBe(user.id);
    expect(stored.eventType).toBe("click");
    expect(stored.metadata.platform).toBe("web");
    expect(stored.metadata.referer).toBe("https://example.test");
  });

  it("records an anonymous event when no token is sent", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app)
      .post("/api/events")
      .send({ postId: post._id, eventType: "share" });

    expect(res.status).toBe(201);
    expect((await AnalyticsEvent.findOne({ postId: post._id })).actorId).toBeNull();
  });

  it("ignores an invalid token instead of rejecting the event", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app)
      .post("/api/events")
      .set(authHeader("not-a-real-token"))
      .send({ postId: post._id, eventType: "view" });

    expect(res.status).toBe(201);
    expect((await AnalyticsEvent.findOne({ postId: post._id })).actorId).toBeNull();
  });

  it("accepts `type` as an alias for `eventType`", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app).post("/api/events").send({ postId: post._id, type: "view" });

    expect(res.status).toBe(201);
    expect(res.body.eventType).toBe("view");
    expect((await AnalyticsEvent.findOne({ postId: post._id })).eventType).toBe("view");
  });

  it("requires a postId and an event type", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    const noType = await request(app).post("/api/events").send({ postId: post._id });
    expect(noType.status).toBe(400);
    expect(noType.body.message).toMatch(/postId and eventType/);

    const noPost = await request(app).post("/api/events").send({ eventType: "view" });
    expect(noPost.status).toBe(400);

    expect(await AnalyticsEvent.countDocuments({})).toBe(0);
  });

  it("rejects an event type outside the tracked set", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app)
      .post("/api/events")
      .send({ postId: post._id, eventType: "doomscroll" });

    expect(res.status).toBe(400);
    expect(await AnalyticsEvent.countDocuments({})).toBe(0);
  });

  it("returns 400 for a malformed postId", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({ postId: "not-an-id", eventType: "view" });
    expect(res.status).toBe(400);
  });

  // NOTE: the endpoint never checks that the post exists, so events can be logged
  // against an id that was never a post. Asserting the current behaviour.
  it("accepts an event for a postId that does not exist", async () => {
    const ghost = new mongoose.Types.ObjectId();
    const res = await request(app).post("/api/events").send({ postId: ghost, eventType: "view" });
    expect(res.status).toBe(201);
    expect(await AnalyticsEvent.countDocuments({ postId: ghost })).toBe(1);
  });

  // NOTE: analyticsController documents this endpoint as POST /api/analytics/events,
  // but routes/index.js mounts the analytics router at "/", so the live path is
  // /api/events (which is what the frontend calls). Asserting the current behaviour.
  it("is not reachable under the documented /api/analytics prefix", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    const res = await request(app)
      .post("/api/analytics/events")
      .send({ postId: post._id, eventType: "view" });
    expect(res.status).toBe(404);
    expect(await AnalyticsEvent.countDocuments({})).toBe(0);
  });
});

describe("GET /api/posts/:id/analytics", () => {
  it("requires authentication", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);
    expect((await request(app).get(`/api/posts/${post._id}/analytics`)).status).toBe(401);
  });

  it("returns counters, an event breakdown and the engagement rate to the author", async () => {
    const author = await registerUser();
    const commenter = await registerUser();
    const post = await createPost(author.user.id, {
      viewCount: 10,
      saveCount: 2,
      reactionCount: 3,
    });
    await request(app)
      .post(`/api/posts/${post._id}/comments`)
      .set(authHeader(commenter.token))
      .send({ text: "same." });
    await logEvents(post._id, ["view", "view", "click", "save"]);

    const res = await request(app)
      .get(`/api/posts/${post._id}/analytics`)
      .set(authHeader(author.token));

    expect(res.status).toBe(200);
    expect(res.body.analytics).toEqual({
      views: 10,
      saves: 2,
      reactions: 3,
      comments: 1,
      // (3 reactions + 2 saves + 1 comment) / max(10 views, 2 view events) * 100
      engagementRate: 60,
      events: { view: 2, click: 1, save: 1 },
    });
  });

  it("falls back to logged view events when the denormalized counter lags", async () => {
    const author = await registerUser();
    const post = await createPost(author.user.id, { saveCount: 1 });
    await logEvents(post._id, ["view", "view", "view", "view"]);

    const res = await request(app)
      .get(`/api/posts/${post._id}/analytics`)
      .set(authHeader(author.token));
    expect(res.status).toBe(200);
    // reads = max(viewCount 0, view events 4) = 4, engagement = 1 save
    expect(res.body.analytics.engagementRate).toBe(25);
  });

  it("reports a zero engagement rate for a post nobody has read", async () => {
    const author = await registerUser();
    const post = await createPost(author.user.id);

    const res = await request(app)
      .get(`/api/posts/${post._id}/analytics`)
      .set(authHeader(author.token));
    expect(res.status).toBe(200);
    expect(res.body.analytics).toMatchObject({ views: 0, engagementRate: 0, events: {} });
  });

  it("returns 403 for anyone other than the author", async () => {
    const author = await registerUser();
    const stranger = await registerUser();
    const post = await createPost(author.user.id);

    const res = await request(app)
      .get(`/api/posts/${post._id}/analytics`)
      .set(authHeader(stranger.token));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  it("returns 404 for a missing post and 400 for a malformed id", async () => {
    const { token } = await registerUser();
    const missing = await request(app)
      .get(`/api/posts/${new mongoose.Types.ObjectId()}/analytics`)
      .set(authHeader(token));
    expect(missing.status).toBe(404);

    const malformed = await request(app).get("/api/posts/nope/analytics").set(authHeader(token));
    expect(malformed.status).toBe(400);
  });
});

describe("GET /api/users/:id/analytics", () => {
  it("requires authentication", async () => {
    const { user } = await registerUser();
    expect((await request(app).get(`/api/users/${user.id}/analytics`)).status).toBe(401);
  });

  it("aggregates counters and events across all of the owner's posts", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const first = await createPost(owner.user.id, { viewCount: 4, saveCount: 1, reactionCount: 2 });
    const second = await createPost(owner.user.id, { viewCount: 6, reactionCount: 1 });
    const foreign = await createPost(other.user.id, { viewCount: 100, saveCount: 50 });

    await logEvents(first._id, ["view", "click"]);
    await logEvents(second._id, ["view", "share"]);
    await logEvents(foreign._id, ["view", "view", "view"]);

    const res = await request(app)
      .get(`/api/users/${owner.user.id}/analytics`)
      .set(authHeader(owner.token));

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ totalViews: 10, totalSaves: 1, totalReactions: 3 });
    expect(res.body.eventBreakdown).toEqual({ view: 2, click: 1, share: 1 });
  });

  it("returns zeroed totals for an author with no posts", async () => {
    const owner = await registerUser();
    const res = await request(app)
      .get(`/api/users/${owner.user.id}/analytics`)
      .set(authHeader(owner.token));

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ totalViews: 0, totalSaves: 0, totalReactions: 0 });
    expect(res.body.eventBreakdown).toEqual({});
  });

  it("returns 403 when asking for someone else's analytics", async () => {
    const owner = await registerUser();
    const stranger = await registerUser();

    const res = await request(app)
      .get(`/api/users/${owner.user.id}/analytics`)
      .set(authHeader(stranger.token));
    expect(res.status).toBe(403);
  });
});
