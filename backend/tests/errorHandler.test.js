// End-to-end proof of the incident path: a request that blows up must reach the
// global error handler, which hands the failure to the error reporter, which
// POSTs a sanitised JSON report to ERROR_WEBHOOK_URL — while the client still
// gets its normal HTTP answer.
//
// errorReporter reads ERROR_WEBHOOK_URL once, at module load, and errorHandler
// binds captureException at its own load. So the whole chain has to be
// re-required behind jest.resetModules() with the env var set, exactly as
// tests/errorReporter.test.js does.
const request = require("supertest");

const WEBHOOK = "https://collector.example/report";

// The literal secrets a request carries in; none may reach the collector.
const SECRET_HEADER = "Bearer super-secret-jwt";
const SECRET_PASSWORD = "hunter2-do-not-leak";

/**
 * Build the real error path (real middleware/errorHandler.js, real
 * utils/errorReporter.js, real utils/metrics.js) on a throwaway Express app.
 *
 * @param {string|undefined} webhook value for ERROR_WEBHOOK_URL, or undefined to unset
 */
const loadWith = (webhook) => {
  jest.resetModules();
  const prev = process.env.ERROR_WEBHOOK_URL;
  if (webhook === undefined) delete process.env.ERROR_WEBHOOK_URL;
  else process.env.ERROR_WEBHOOK_URL = webhook;

  const express = require("express");
  const { errorHandler } = require("../middleware/errorHandler");
  const ApiError = require("../utils/ApiError");
  const metrics = require("../utils/metrics");
  const { captureException, isForwardingEnabled } = require("../utils/errorReporter");

  metrics.registry.reset();

  const app = express();
  app.use(express.json());

  // Stand in for requestLogger + auth: the handler reads req.id and req.user.id.
  // req.user deliberately also carries credentials the report must not copy.
  app.use((req, res, next) => {
    req.id = "req-abc123";
    req.user = { id: "user-42", password: SECRET_PASSWORD, token: SECRET_HEADER };
    next();
  });

  const router = express.Router();

  router.post("/boom", () => {
    throw new Error("kaboom");
  });
  // Mounted under an id segment so the route label exercises normalizeRoute().
  router.get("/boom/:id", () => {
    throw new Error("kaboom by id");
  });
  router.get("/async-boom", async () => {
    throw new TypeError("kaboom later");
  });
  router.get("/expected", () => {
    throw new ApiError(400, "you sent nonsense");
  });
  router.get("/cast", () => {
    const err = new Error('Cast to ObjectId failed for value "nope"');
    err.name = "CastError";
    throw err;
  });
  router.get("/invalid", () => {
    const err = new Error("things validation failed");
    err.name = "ValidationError";
    err.errors = {
      content: { message: "content is required" },
      visibility: { message: "visibility must be public or private" },
    };
    throw err;
  });
  router.get("/duplicate", () => {
    const err = new Error("E11000 duplicate key error");
    err.code = 11000;
    throw err;
  });

  app.use("/api/things", router);
  app.use(errorHandler);

  return {
    app,
    metrics,
    captureException,
    isForwardingEnabled,
    restore: () => {
      if (prev === undefined) delete process.env.ERROR_WEBHOOK_URL;
      else process.env.ERROR_WEBHOOK_URL = prev;
      jest.resetModules();
    },
  };
};

/** Let the fire-and-forget forward() settle (and clear its abort timer). */
const settle = () => new Promise((r) => setTimeout(r, 10));

describe("errorHandler -> errorReporter (incident forwarding)", () => {
  it("POSTs a full incident report to ERROR_WEBHOOK_URL on a 500", async () => {
    const { app, isForwardingEnabled, restore } = loadWith(WEBHOOK);
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    try {
      expect(isForwardingEnabled()).toBe(true);

      const res = await request(app).post("/api/things/boom").send({ title: "t" });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ status: "error", statusCode: 500, message: "kaboom" });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(WEBHOOK);
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });

      const body = JSON.parse(init.body);
      // Exact wire shape, so operators can rely on it.
      expect(Object.keys(body).sort()).toEqual([
        "context",
        "level",
        "message",
        "name",
        "service",
        "stack",
        "timestamp",
      ]);
      expect(Object.keys(body.context).sort()).toEqual([
        "method",
        "requestId",
        "route",
        "statusCode",
        "userId",
      ]);
      expect(body).toMatchObject({
        name: "Error",
        message: "kaboom",
        level: "error",
        service: "unsent-archives-api",
        context: {
          route: "/api/things/boom",
          method: "POST",
          statusCode: 500,
          requestId: "req-abc123",
          userId: "user-42",
        },
      });
      expect(typeof body.stack).toBe("string");
      expect(body.stack).toContain("Error: kaboom");
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);

      await settle();
    } finally {
      fetchSpy.mockRestore();
      restore();
    }
  });

  it("labels the route with ids collapsed and reports async rejections too", async () => {
    const { app, restore } = loadWith(WEBHOOK);
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    try {
      const byId = await request(app).get("/api/things/boom/507f1f77bcf86cd799439011");
      expect(byId.status).toBe(500);

      const asyncRes = await request(app).get("/api/things/async-boom");
      expect(asyncRes.status).toBe(500);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const first = JSON.parse(fetchSpy.mock.calls[0][1].body);
      const second = JSON.parse(fetchSpy.mock.calls[1][1].body);

      expect(first.context.route).toBe("/api/things/boom/:id");
      expect(first.context.method).toBe("GET");
      expect(second).toMatchObject({
        name: "TypeError",
        message: "kaboom later",
        context: { route: "/api/things/async-boom", statusCode: 500 },
      });

      await settle();
    } finally {
      fetchSpy.mockRestore();
      restore();
    }
  });

  it("keeps credentials off the wire", async () => {
    const { app, captureException, restore } = loadWith(WEBHOOK);
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    try {
      await request(app)
        .post("/api/things/boom")
        .set("Authorization", SECRET_HEADER)
        .set("Cookie", "session=abc")
        .send({ password: SECRET_PASSWORD, token: "t0ken" });

      const raw = fetchSpy.mock.calls[0][1].body;
      expect(typeof raw).toBe("string");
      // Neither the credential-bearing keys nor their values survive the trip.
      expect(raw).not.toMatch(/password/i);
      expect(raw).not.toMatch(/token/i);
      expect(raw).not.toMatch(/authorization/i);
      expect(raw).not.toMatch(/cookie/i);
      expect(raw).not.toContain(SECRET_PASSWORD);
      expect(raw).not.toContain(SECRET_HEADER);

      // ...and a caller that hands the reporter sensitive context loses it too.
      fetchSpy.mockClear();
      captureException(new Error("direct"), {
        route: "/api/things/boom",
        password: SECRET_PASSWORD,
        Authorization: SECRET_HEADER,
        accessToken: "a",
      });
      const direct = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(direct.context).toEqual({ route: "/api/things/boom" });

      await settle();
    } finally {
      fetchSpy.mockRestore();
      restore();
    }
  });
});

describe("errorHandler: expected failures are not incidents", () => {
  it("answers an ApiError 4xx without reporting it", async () => {
    const { app, metrics, restore } = loadWith(WEBHOOK);
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    try {
      const res = await request(app).get("/api/things/expected");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ status: "fail", statusCode: 400, message: "you sent nonsense" });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(metrics.unhandledErrorsTotal.get({ name: "Error" })).toBe(0);
    } finally {
      fetchSpy.mockRestore();
      restore();
    }
  });

  it("translates mongoose failures to 4xx/409 without reporting them", async () => {
    const { app, metrics, restore } = loadWith(WEBHOOK);
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    try {
      const cast = await request(app).get("/api/things/cast");
      expect(cast.status).toBe(400);
      expect(cast.body.message).toBe("Resource not found with that ID");

      const invalid = await request(app).get("/api/things/invalid");
      expect(invalid.status).toBe(400);
      expect(invalid.body.message).toBe(
        "content is required, visibility must be public or private"
      );

      const dupe = await request(app).get("/api/things/duplicate");
      expect(dupe.status).toBe(409);
      // Note: the handler derives `status` from the leading digit, so a 409
      // reads as "fail" rather than "error".
      expect(dupe.body).toEqual({
        status: "fail",
        statusCode: 409,
        message: "Duplicate field value entered",
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(metrics.unhandledErrorsTotal.get({ name: "CastError" })).toBe(0);
      expect(metrics.unhandledErrorsTotal.get({ name: "ValidationError" })).toBe(0);
      expect(metrics.unhandledErrorsTotal.get({ name: "Error" })).toBe(0);
    } finally {
      fetchSpy.mockRestore();
      restore();
    }
  });
});

describe("errorHandler: metrics and resilience", () => {
  it("increments unhandled_errors_total per error name for 500s only", async () => {
    const { app, metrics, restore } = loadWith(undefined);
    try {
      await request(app).post("/api/things/boom").send({});
      await request(app).get("/api/things/boom/1");
      await request(app).get("/api/things/async-boom");
      await request(app).get("/api/things/expected");
      await request(app).get("/api/things/cast");

      expect(metrics.unhandledErrorsTotal.get({ name: "Error" })).toBe(2);
      expect(metrics.unhandledErrorsTotal.get({ name: "TypeError" })).toBe(1);
      expect(metrics.registry.render()).toContain('unhandled_errors_total{name="Error"} 2');
    } finally {
      restore();
    }
  });

  it("still answers the client when the webhook rejects", async () => {
    const { app, metrics, restore } = loadWith(WEBHOOK);
    const fetchSpy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    try {
      const res = await request(app).post("/api/things/boom").send({});

      // Identical to the healthy-webhook response above: forwarding is invisible.
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ status: "error", statusCode: 500, message: "kaboom" });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(metrics.unhandledErrorsTotal.get({ name: "Error" })).toBe(1);

      // Settle the rejected forward; an unhandled rejection would surface here.
      await settle();
    } finally {
      fetchSpy.mockRestore();
      restore();
    }
  });
});

describe("errorHandler mounted in the real app", () => {
  it("answers an unknown route 404 and reports nothing", async () => {
    const app = require("../app");
    const { unhandledErrorsTotal, registry } = require("../utils/metrics");
    registry.reset();
    const fetchSpy = jest.spyOn(global, "fetch");
    try {
      const res = await request(app).get("/api/definitely-not-a-route");
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ status: "fail", statusCode: 404 });
      expect(res.body.message).toContain("not found");

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(unhandledErrorsTotal.get({ name: "Error" })).toBe(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
