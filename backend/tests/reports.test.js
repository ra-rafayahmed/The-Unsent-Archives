const mongoose = require("mongoose");
const {
  app,
  request,
  registerUser,
  createPost,
  authHeader,
  User,
  Post,
} = require("./helpers/factories");
const { Report } = require("../models");

const REASONS = ["spam", "harassment", "hate", "self-harm", "nsfw", "impersonation", "other"];

describe("GET /api/reports/reasons", () => {
  it("lists the accepted reasons to anonymous visitors", async () => {
    const res = await request(app).get("/api/reports/reasons");
    expect(res.status).toBe(200);
    expect(res.body.reasons).toEqual(REASONS);
  });
});

describe("POST /api/reports", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({ targetType: "post", targetId: new mongoose.Types.ObjectId(), reason: "spam" });
    expect(res.status).toBe(401);
  });

  it("files a report against a post and bumps the post's reportCount", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await createPost(author.user.id);

    const res = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({ targetType: "post", targetId: post._id, reason: "harassment", note: "not ok" });

    expect(res.status).toBe(201);
    expect(res.body.report).toMatchObject({
      reporterId: reporter.user.id,
      targetType: "post",
      targetId: String(post._id),
      reason: "harassment",
      note: "not ok",
      status: "open",
      resolvedBy: null,
      resolvedAt: null,
    });

    expect(await Report.countDocuments({})).toBe(1);
    expect((await Post.findById(post._id)).reportCount).toBe(1);
  });

  it("files a report against a user and bumps the reported user's reportCount", async () => {
    const target = await registerUser();
    const reporter = await registerUser();

    const res = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({ targetType: "user", targetId: target.user.id, reason: "impersonation" });

    expect(res.status).toBe(201);
    expect(res.body.report).toMatchObject({ targetType: "user", targetId: target.user.id });
    expect((await User.findById(target.user.id)).reportCount).toBe(1);
  });

  it("keeps only the first 500 characters of the reporter's note", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await createPost(author.user.id);

    const res = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({
        targetType: "post",
        targetId: post._id,
        reason: "other",
        note: "x".repeat(600),
      });

    expect(res.status).toBe(201);
    expect(res.body.report.note).toHaveLength(500);
  });

  it("does not file a duplicate while an earlier report is still open", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await createPost(author.user.id);
    const payload = { targetType: "post", targetId: post._id, reason: "spam" };

    const first = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.body.message).toMatch(/already filed/i);
    expect(second.body.report._id).toBe(first.body.report._id);

    expect(await Report.countDocuments({})).toBe(1);
    expect((await Post.findById(post._id)).reportCount).toBe(1);
  });

  it("lets a different user report the same post", async () => {
    const author = await registerUser();
    const first = await registerUser();
    const second = await registerUser();
    const post = await createPost(author.user.id);
    const payload = { targetType: "post", targetId: post._id, reason: "nsfw" };

    await request(app).post("/api/reports").set(authHeader(first.token)).send(payload);
    const res = await request(app).post("/api/reports").set(authHeader(second.token)).send(payload);

    expect(res.status).toBe(201);
    expect(await Report.countDocuments({})).toBe(2);
    expect((await Post.findById(post._id)).reportCount).toBe(2);
  });

  it("rejects an unknown targetType, an unknown reason and a missing targetId", async () => {
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await createPost(author.user.id);

    const badType = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({ targetType: "comment", targetId: post._id, reason: "spam" });
    expect(badType.status).toBe(400);
    expect(badType.body.message).toMatch(/targetType/);

    const badReason = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({ targetType: "post", targetId: post._id, reason: "because" });
    expect(badReason.status).toBe(400);
    expect(badReason.body.message).toMatch(/reason/i);

    const noTarget = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({ targetType: "post", reason: "spam" });
    expect(noTarget.status).toBe(400);

    expect(await Report.countDocuments({})).toBe(0);
  });

  it("refuses to report yourself or your own post", async () => {
    const me = await registerUser();
    const myPost = await createPost(me.user.id);

    const self = await request(app)
      .post("/api/reports")
      .set(authHeader(me.token))
      .send({ targetType: "user", targetId: me.user.id, reason: "spam" });
    expect(self.status).toBe(400);
    expect(self.body.message).toMatch(/cannot report yourself/i);

    const ownPost = await request(app)
      .post("/api/reports")
      .set(authHeader(me.token))
      .send({ targetType: "post", targetId: myPost._id, reason: "spam" });
    expect(ownPost.status).toBe(400);
    expect(ownPost.body.message).toMatch(/your own post/i);

    expect(await Report.countDocuments({})).toBe(0);
  });

  it("returns 404 when the reported post or user does not exist", async () => {
    const reporter = await registerUser();
    const ghost = new mongoose.Types.ObjectId();

    const post = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({ targetType: "post", targetId: ghost, reason: "spam" });
    expect(post.status).toBe(404);
    expect(post.body.message).toBe("Post not found");

    const user = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({ targetType: "user", targetId: ghost, reason: "spam" });
    expect(user.status).toBe(404);
    expect(user.body.message).toBe("User not found");
  });

  it("returns 400 for a malformed targetId", async () => {
    const reporter = await registerUser();
    const res = await request(app)
      .post("/api/reports")
      .set(authHeader(reporter.token))
      .send({ targetType: "post", targetId: "not-an-id", reason: "spam" });
    expect(res.status).toBe(400);
  });
});
