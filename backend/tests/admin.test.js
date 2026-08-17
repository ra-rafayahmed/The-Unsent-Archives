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
const { Collection, Follow, MediaAsset, Report, SearchIndex } = require("../models");
const { TEST_PASSWORD, NEW_PASSWORD } = require("./helpers/constants");

/** env.js puts admin@example.com in ADMIN_EMAILS, so this registers an admin. */
const registerAdmin = () => registerUser({ email: "admin@example.com" });

const fileReport = async (token, body) => {
  const res = await request(app).post("/api/reports").set(authHeader(token)).send(body);
  expect(res.status).toBe(201);
  return res.body.report;
};

describe("admin route guards", () => {
  it("returns 401 without a token", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    expect((await request(app).get("/api/admin/reports")).status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    const { token } = await registerUser();
    const read = await request(app).get("/api/admin/users").set(authHeader(token));
    expect(read.status).toBe(403);
    expect(read.body.message).toBe("Admin access denied");

    const post = await createPost((await registerUser()).user.id);
    const write = await request(app).delete(`/api/admin/posts/${post._id}`).set(authHeader(token));
    expect(write.status).toBe(403);
    expect(await Post.findById(post._id)).not.toBeNull();
  });

  it("checks the live role rather than the role baked into the token", async () => {
    const admin = await registerAdmin();
    const promoted = await registerUser();

    expect(
      (await request(app).get("/api/admin/users").set(authHeader(promoted.token))).status
    ).toBe(403);

    await request(app)
      .put(`/api/admin/users/${promoted.user.id}/role`)
      .set(authHeader(admin.token))
      .send({ role: "admin" });

    expect(
      (await request(app).get("/api/admin/users").set(authHeader(promoted.token))).status
    ).toBe(200);
  });

  it("denies an admin whose account has been deactivated", async () => {
    const admin = await registerAdmin();
    await User.findByIdAndUpdate(admin.user.id, { isActive: false });

    const res = await request(app).get("/api/admin/users").set(authHeader(admin.token));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/users", () => {
  it("lists every account for an admin", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();

    const res = await request(app).get("/api/admin/users").set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.results).toBe(2);

    const listed = res.body.users.find((u) => u.username === member.user.username);
    expect(listed).toMatchObject({
      email: member.user.email,
      role: "user",
      isActive: true,
      isSuspended: false,
      reportCount: 0,
    });
    expect(listed.passwordHash).toBeUndefined();
  });

  it("sorts by report count when asked", async () => {
    const admin = await registerAdmin();
    const quiet = await registerUser();
    const flagged = await registerUser();
    await User.findByIdAndUpdate(flagged.user.id, { reportCount: 5 });

    const res = await request(app)
      .get("/api/admin/users?sort=reports")
      .set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.users[0].username).toBe(flagged.user.username);
    expect(res.body.users.map((u) => u.username)).toContain(quiet.user.username);
  });
});

describe("GET /api/admin/posts", () => {
  it("lists posts with their author, including anonymous ones", async () => {
    const admin = await registerAdmin();
    const author = await registerUser();
    await createPost(author.user.id, { isAnonymous: true, content: "hidden letter" });

    const res = await request(app).get("/api/admin/posts").set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.results).toBe(1);
    expect(res.body.posts[0]).toMatchObject({ content: "hidden letter", isAnonymous: true });
    expect(res.body.posts[0].authorId).toMatchObject({
      username: author.user.username,
      email: author.user.email,
    });
  });
});

describe("PUT /api/admin/users/:id/role", () => {
  it("changes a user's role", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();

    const res = await request(app)
      .put(`/api/admin/users/${member.user.id}/role`)
      .set(authHeader(admin.token))
      .send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ _id: member.user.id, role: "admin" });
    expect((await User.findById(member.user.id)).role).toBe("admin");
  });

  it("rejects an unknown role and a missing user", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();

    const bad = await request(app)
      .put(`/api/admin/users/${member.user.id}/role`)
      .set(authHeader(admin.token))
      .send({ role: "superuser" });
    expect(bad.status).toBe(400);
    expect((await User.findById(member.user.id)).role).toBe("user");

    const missing = await request(app)
      .put(`/api/admin/users/${new mongoose.Types.ObjectId()}/role`)
      .set(authHeader(admin.token))
      .send({ role: "admin" });
    expect(missing.status).toBe(404);
  });
});

describe("PUT /api/admin/users/:id/suspend", () => {
  it("suspends an account so its owner can no longer log in", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();

    const res = await request(app)
      .put(`/api/admin/users/${member.user.id}/suspend`)
      .set(authHeader(admin.token))
      .send({ suspended: true });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ isSuspended: true, isActive: false });

    const stored = await User.findById(member.user.id);
    expect(stored.isSuspended).toBe(true);
    expect(stored.isActive).toBe(false);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: member.user.email, password: TEST_PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.message).toMatch(/suspended/i);
  });

  it("restores access when the suspension is lifted", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();
    const url = `/api/admin/users/${member.user.id}/suspend`;

    await request(app).put(url).set(authHeader(admin.token)).send({ suspended: true });
    const lifted = await request(app)
      .put(url)
      .set(authHeader(admin.token))
      .send({ suspended: false });
    expect(lifted.status).toBe(200);
    expect(lifted.body.user).toMatchObject({ isSuspended: false, isActive: true });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: member.user.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  // NOTE: the endpoint does not validate `suspended`, so an empty body is read as
  // "unsuspend" (Boolean(undefined) === false). Asserting the current behaviour.
  it("treats a body without `suspended` as lifting the suspension", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();
    await User.findByIdAndUpdate(member.user.id, { isSuspended: true, isActive: false });

    const res = await request(app)
      .put(`/api/admin/users/${member.user.id}/suspend`)
      .set(authHeader(admin.token))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ isSuspended: false, isActive: true });
  });

  it("returns 404 for an unknown user", async () => {
    const admin = await registerAdmin();
    const res = await request(app)
      .put(`/api/admin/users/${new mongoose.Types.ObjectId()}/suspend`)
      .set(authHeader(admin.token))
      .send({ suspended: true });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/posts/:id", () => {
  it("deletes any post and cascades its dependent rows", async () => {
    const admin = await registerAdmin();
    const author = await registerUser();
    const reporter = await registerUser();

    const created = await request(app)
      .post("/api/posts")
      .set(authHeader(author.token))
      .send({ content: "offending letter", tags: ["grief"] });
    const postId = created.body.post._id;
    await fileReport(reporter.token, { targetType: "post", targetId: postId, reason: "hate" });

    const res = await request(app)
      .delete(`/api/admin/posts/${postId}`)
      .set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Post deleted by admin");

    expect(await Post.findById(postId)).toBeNull();
    expect(await SearchIndex.findOne({ postId })).toBeNull();
    expect(await Report.countDocuments({ targetType: "post", targetId: postId })).toBe(0);
  });

  it("returns 404 for a post that is already gone", async () => {
    const admin = await registerAdmin();
    const res = await request(app)
      .delete(`/api/admin/posts/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("removes the account together with its posts, follows, collections and media", async () => {
    const admin = await registerAdmin();
    const victim = await registerUser();
    const other = await registerUser();

    const victimPost = await createPost(victim.user.id);
    const otherPost = await createPost(other.user.id);
    await request(app)
      .post(`/api/posts/${otherPost._id}/comments`)
      .set(authHeader(victim.token))
      .send({ text: "left behind" });
    await Collection.create({ ownerId: victim.user.id, name: "Mine" });
    await Follow.create({ followerId: victim.user.id, followeeId: other.user.id });
    await MediaAsset.create({
      ownerId: victim.user.id,
      url: "http://example.test/x.png",
      fileName: "x.png",
      mimeType: "image/png",
      size: 3,
      mediaType: "image",
    });
    await fileReport(victim.token, {
      targetType: "user",
      targetId: other.user.id,
      reason: "spam",
    });

    const res = await request(app)
      .delete(`/api/admin/users/${victim.user.id}`)
      .set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted by admin/i);

    expect(await User.findById(victim.user.id)).toBeNull();
    expect(await Post.findById(victimPost._id)).toBeNull();
    expect(await Collection.countDocuments({ ownerId: victim.user.id })).toBe(0);
    expect(await Follow.countDocuments({ followerId: victim.user.id })).toBe(0);
    expect(await MediaAsset.countDocuments({ ownerId: victim.user.id })).toBe(0);
    expect(await Report.countDocuments({ reporterId: victim.user.id })).toBe(0);
    expect((await Post.findById(otherPost._id)).comments).toHaveLength(0);
  });

  it("refuses to delete the acting admin's own account", async () => {
    const admin = await registerAdmin();
    const res = await request(app)
      .delete(`/api/admin/users/${admin.user.id}`)
      .set(authHeader(admin.token));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/own account/i);
    expect(await User.findById(admin.user.id)).not.toBeNull();
  });

  it("returns 404 for an unknown user", async () => {
    const admin = await registerAdmin();
    const res = await request(app)
      .delete(`/api/admin/users/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/users/:id/issue-reset", () => {
  it("issues a working one-time reset token for a locked-out user", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();

    const res = await request(app)
      .post(`/api/admin/users/${member.user.id}/issue-reset`)
      .set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: member.user.id, email: member.user.email });
    expect(res.body.resetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.resetLink).toContain(`/reset-password?token=${res.body.resetToken}`);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const stored = await User.findById(member.user.id).select("+passwordResetTokenHash");
    expect(stored.passwordResetTokenHash).toBeTruthy();
    expect(stored.passwordResetTokenHash).not.toBe(res.body.resetToken);

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: res.body.resetToken, password: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: member.user.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
  });

  it("returns 404 for an unknown user", async () => {
    const admin = await registerAdmin();
    const res = await request(app)
      .post(`/api/admin/users/${new mongoose.Types.ObjectId()}/issue-reset`)
      .set(authHeader(admin.token));
    expect(res.status).toBe(404);
  });
});

describe("admin report queue", () => {
  it("lists open reports with their hydrated target", async () => {
    const admin = await registerAdmin();
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await createPost(author.user.id);

    await fileReport(reporter.token, {
      targetType: "post",
      targetId: post._id,
      reason: "nsfw",
      note: "graphic",
    });
    await fileReport(reporter.token, {
      targetType: "user",
      targetId: author.user.id,
      reason: "harassment",
    });

    const res = await request(app).get("/api/admin/reports").set(authHeader(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.results).toBe(2);

    const byType = Object.fromEntries(res.body.reports.map((r) => [r.targetType, r]));
    expect(byType.post.reporterId.username).toBe(reporter.user.username);
    expect(byType.post.target).toMatchObject({ content: "An unsent letter.", reportCount: 1 });
    expect(byType.post.target.authorId.username).toBe(author.user.username);
    expect(byType.user.target).toMatchObject({
      username: author.user.username,
      email: author.user.email,
      reportCount: 1,
    });
  });

  it("resolves a report and records who closed it", async () => {
    const admin = await registerAdmin();
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await createPost(author.user.id);
    const report = await fileReport(reporter.token, {
      targetType: "post",
      targetId: post._id,
      reason: "spam",
    });

    const res = await request(app)
      .put(`/api/admin/reports/${report._id}/resolve`)
      .set(authHeader(admin.token))
      .send({ action: "resolved" });
    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ status: "resolved", resolvedBy: admin.user.id });
    expect(res.body.report.resolvedAt).toBeTruthy();

    const stored = await Report.findById(report._id);
    expect(stored.status).toBe("resolved");
    expect(String(stored.resolvedBy)).toBe(admin.user.id);

    // Resolving must not re-run the "new report" counter bump.
    expect((await Post.findById(post._id)).reportCount).toBe(1);
  });

  it("hides resolved reports from the default queue but not from status=all", async () => {
    const admin = await registerAdmin();
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await createPost(author.user.id);
    const report = await fileReport(reporter.token, {
      targetType: "post",
      targetId: post._id,
      reason: "spam",
    });

    await request(app)
      .put(`/api/admin/reports/${report._id}/resolve`)
      .set(authHeader(admin.token))
      .send({ action: "dismissed" });

    const open = await request(app).get("/api/admin/reports").set(authHeader(admin.token));
    expect(open.body.results).toBe(0);

    const all = await request(app)
      .get("/api/admin/reports?status=all")
      .set(authHeader(admin.token));
    expect(all.body.results).toBe(1);
    expect(all.body.reports[0].status).toBe("dismissed");
    expect(all.body.reports[0].resolvedBy.username).toBe(admin.user.username);
  });

  it("rejects an unknown resolve action and a missing report", async () => {
    const admin = await registerAdmin();
    const author = await registerUser();
    const reporter = await registerUser();
    const post = await createPost(author.user.id);
    const report = await fileReport(reporter.token, {
      targetType: "post",
      targetId: post._id,
      reason: "spam",
    });

    const bad = await request(app)
      .put(`/api/admin/reports/${report._id}/resolve`)
      .set(authHeader(admin.token))
      .send({ action: "ignore" });
    expect(bad.status).toBe(400);
    expect((await Report.findById(report._id)).status).toBe("open");

    const missing = await request(app)
      .put(`/api/admin/reports/${new mongoose.Types.ObjectId()}/resolve`)
      .set(authHeader(admin.token))
      .send({ action: "resolved" });
    expect(missing.status).toBe(404);
  });
});
