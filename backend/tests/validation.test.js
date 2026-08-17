// Boundary validation: every mutating route should reject a malformed body at
// the edge (Joi) rather than letting it reach a controller or the driver.
const mongoose = require("mongoose");
const { app, request, registerUser, createPost, authHeader } = require("./helpers/factories");
const { Reaction, Follow, Report, AnalyticsEvent } = require("../models");

const expectValidationError = (res, pattern) => {
  expect(res.status).toBe(400);
  expect(res.body.status).toBe("fail");
  expect(res.body.message).toMatch(pattern);
};

describe("reaction body validation", () => {
  it("rejects a missing or unknown reaction type and stores nothing", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);
    const url = `/api/posts/${post._id}/reactions`;

    for (const body of [{}, { type: "yikes" }, { type: "" }, { type: 5 }]) {
      const res = await request(app).post(url).set(authHeader(token)).send(body);
      expectValidationError(res, /type/i);
    }
    expect(await Reaction.countDocuments({})).toBe(0);
  });

  it("rejects an unknown type on delete but allows an omitted one", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);
    const url = `/api/posts/${post._id}/reactions`;
    await request(app).post(url).set(authHeader(token)).send({ type: "like" });

    expectValidationError(
      await request(app).delete(url).set(authHeader(token)).send({ type: "nope" }),
      /type/i
    );

    // No type at all means "remove whatever I left".
    const res = await request(app).delete(url).set(authHeader(token)).send({});
    expect(res.status).toBe(200);
    expect(await Reaction.countDocuments({})).toBe(0);
  });
});

describe("comment body validation", () => {
  it("rejects an empty, whitespace-only or oversized comment", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);
    const url = `/api/posts/${post._id}/comments`;

    expectValidationError(
      await request(app).post(url).set(authHeader(token)).send({}),
      /required/i
    );
    expectValidationError(
      await request(app).post(url).set(authHeader(token)).send({ text: "   " }),
      /required|empty/i
    );
    expectValidationError(
      await request(app)
        .post(url)
        .set(authHeader(token))
        .send({ text: "x".repeat(1001) }),
      /1000/
    );

    const stored = await request(app).get(`/api/posts/${post._id}`);
    expect(stored.body.post.comments).toHaveLength(0);
  });

  it("rejects a non-boolean isAnonymous flag", async () => {
    const { user, token } = await registerUser();
    const post = await createPost(user.id);
    expectValidationError(
      await request(app)
        .post(`/api/posts/${post._id}/comments`)
        .set(authHeader(token))
        .send({ text: "hi", isAnonymous: "yes please" }),
      /isAnonymous/i
    );
  });
});

describe("follow body validation", () => {
  it("requires a well-formed followeeId on the global route", async () => {
    const { token } = await registerUser();

    for (const body of [{}, { followeeId: "" }, { followeeId: "not-an-id" }]) {
      expectValidationError(
        await request(app).post("/api/follows").set(authHeader(token)).send(body),
        /followeeId|Invalid ID/i
      );
    }
    expect(await Follow.countDocuments({})).toBe(0);
  });
});

describe("report body validation", () => {
  it("rejects unknown target types, reasons and malformed ids", async () => {
    const reporter = await registerUser();
    const other = await registerUser();

    const bad = [
      [{ targetType: "comment", targetId: other.user.id, reason: "spam" }, /targetType/],
      [{ targetType: "user", targetId: "nope", reason: "spam" }, /Invalid ID|targetId/],
      [{ targetType: "user", targetId: other.user.id, reason: "because" }, /reason/i],
      [{ targetType: "user", targetId: other.user.id }, /reason/i],
      [{ reason: "spam" }, /targetType/],
    ];

    for (const [body, pattern] of bad) {
      expectValidationError(
        await request(app).post("/api/reports").set(authHeader(reporter.token)).send(body),
        pattern
      );
    }
    expect(await Report.countDocuments({})).toBe(0);
  });
});

describe("analytics event validation", () => {
  it("rejects a malformed postId or unknown event type without writing a row", async () => {
    const bad = [
      { postId: "not-an-id", eventType: "view" },
      { postId: new mongoose.Types.ObjectId(), eventType: "explode" },
      { postId: new mongoose.Types.ObjectId() },
      { eventType: "view" },
      {},
    ];

    for (const body of bad) {
      const res = await request(app).post("/api/events").send(body);
      expect(res.status).toBe(400);
    }
    expect(await AnalyticsEvent.countDocuments({})).toBe(0);
  });

  it("still accepts either eventType or the type alias", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    for (const body of [
      { postId: post._id, eventType: "click" },
      { postId: post._id, type: "share" },
    ]) {
      const res = await request(app).post("/api/events").send(body);
      expect(res.status).toBe(201);
    }
    expect(await AnalyticsEvent.countDocuments({ postId: post._id })).toBe(2);
  });
});

describe("admin body validation", () => {
  const registerAdmin = () => registerUser({ email: "admin@example.com", username: "root_admin" });

  it("rejects an unknown role", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();

    expectValidationError(
      await request(app)
        .put(`/api/admin/users/${member.user.id}/role`)
        .set(authHeader(admin.token))
        .send({ role: "superuser" }),
      /role/i
    );
  });

  it("rejects a non-boolean suspended flag", async () => {
    const admin = await registerAdmin();
    const member = await registerUser();

    expectValidationError(
      await request(app)
        .put(`/api/admin/users/${member.user.id}/suspend`)
        .set(authHeader(admin.token))
        .send({ suspended: "yes" }),
      /suspended must be true or false/
    );
  });
});
