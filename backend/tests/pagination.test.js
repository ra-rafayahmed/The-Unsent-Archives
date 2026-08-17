const { app, request, registerUser, createPost, authHeader } = require("./helpers/factories");
const { getPagination } = require("../utils/pagination");

describe("getPagination", () => {
  it("applies defaults for missing or non-numeric input", () => {
    expect(getPagination(undefined, undefined)).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination("abc", "xyz")).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("computes skip from page and limit", () => {
    expect(getPagination("3", "10")).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it("caps limit at the maximum", () => {
    expect(getPagination("1", "1000")).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(getPagination("1", "50", 20, 25)).toEqual({ page: 1, limit: 25, skip: 0 });
  });

  it("never returns a negative page, limit or skip", () => {
    // A negative skip is rejected by MongoDB, so this must be clamped here.
    expect(getPagination("-5", "20")).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination("0", "20")).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination("1", "-1")).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination("-1", "-1")).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("floors fractional input to whole records", () => {
    expect(getPagination("2.9", "5.7")).toEqual({ page: 2, limit: 5, skip: 5 });
  });
});

describe("paginated endpoints with hostile query strings", () => {
  it("serves the first page instead of erroring on a negative page", async () => {
    const { user } = await registerUser();
    await createPost(user.id, { content: "only note" });

    const res = await request(app).get("/api/feed").query({ page: -5, limit: 20 });
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.posts.map((p) => p.content)).toEqual(["only note"]);
  });

  it("ignores a negative limit rather than passing it to the driver", async () => {
    const { user } = await registerUser();
    await createPost(user.id);
    const res = await request(app).get("/api/feed").query({ limit: -1 });
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
  });

  it("clamps pagination on the followers list too", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await request(app).post(`/api/users/${b.user.id}/follow`).set(authHeader(a.token));

    const res = await request(app).get(`/api/users/${b.user.id}/followers`).query({ page: -3 });
    expect(res.status).toBe(200);
    expect(res.body.followers).toHaveLength(1);
  });
});
