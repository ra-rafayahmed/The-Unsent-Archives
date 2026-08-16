const { app, request } = require("./helpers/factories");

describe("GET /api/health", () => {
  it("reports ok with a connected database", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      service: "unsent-archives-api",
      db: { connected: true, state: "connected" },
    });
    expect(typeof res.body.uptime).toBe("number");
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404 from the global error handler", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: "fail", statusCode: 404 });
    expect(res.body.message).toMatch(/not found/i);
  });
});
