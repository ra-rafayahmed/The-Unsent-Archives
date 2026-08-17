const { sanitizeContext } = require("../utils/errorReporter");

describe("sanitizeContext", () => {
  it("keeps ordinary diagnostic context", () => {
    const ctx = { requestId: "r1", userId: "u1", route: "/api/posts/:id", statusCode: 500 };
    expect(sanitizeContext(ctx)).toEqual(ctx);
  });

  it("drops credential-bearing keys regardless of casing", () => {
    const out = sanitizeContext({
      userId: "u1",
      password: "secret",
      passwordHash: "$2a$...",
      Token: "jwt.value",
      AUTHORIZATION: "Bearer x",
      jwt: "y",
    });
    expect(out).toEqual({ userId: "u1" });
  });

  it("also redacts common variant names", () => {
    const out = sanitizeContext({
      keep: "yes",
      accessToken: "a",
      refresh_token: "b",
      userPassword: "c",
      apiKey: "d",
      Cookie: "e",
      JWT_SECRET: "f",
    });
    expect(out).toEqual({ keep: "yes" });
  });

  it("tolerates being called with nothing", () => {
    expect(sanitizeContext()).toEqual({});
    expect(sanitizeContext({})).toEqual({});
  });
});

describe("captureException", () => {
  const loadWith = (env) => {
    jest.resetModules();
    const prev = process.env.ERROR_WEBHOOK_URL;
    if (env.webhook === undefined) delete process.env.ERROR_WEBHOOK_URL;
    else process.env.ERROR_WEBHOOK_URL = env.webhook;
    const mod = require("../utils/errorReporter");
    const metrics = require("../utils/metrics");
    return {
      mod,
      metrics,
      restore: () => {
        if (prev === undefined) delete process.env.ERROR_WEBHOOK_URL;
        else process.env.ERROR_WEBHOOK_URL = prev;
        jest.resetModules();
      },
    };
  };

  it("counts the error by name and reports forwarding as disabled without a webhook", () => {
    const { mod, metrics, restore } = loadWith({ webhook: undefined });
    try {
      metrics.registry.reset();
      expect(mod.isForwardingEnabled()).toBe(false);

      mod.captureException(new TypeError("boom"), { userId: "u1" });
      mod.captureException(new TypeError("boom again"), {});

      expect(metrics.unhandledErrorsTotal.get({ name: "TypeError" })).toBe(2);
    } finally {
      restore();
    }
  });

  it("does not throw on a non-Error value", () => {
    const { mod, metrics, restore } = loadWith({ webhook: undefined });
    try {
      metrics.registry.reset();
      expect(() => mod.captureException("just a string")).not.toThrow();
      expect(metrics.unhandledErrorsTotal.get({ name: "Error" })).toBe(1);
    } finally {
      restore();
    }
  });

  it("posts a sanitised JSON report when ERROR_WEBHOOK_URL is set", async () => {
    const { mod, restore } = loadWith({ webhook: "https://collector.example/report" });
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    try {
      expect(mod.isForwardingEnabled()).toBe(true);

      mod.captureException(new Error("kaboom"), { userId: "u1", password: "nope" }, "fatal");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://collector.example/report");
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        name: "Error",
        message: "kaboom",
        level: "fatal",
        service: "unsent-archives-api",
        context: { userId: "u1" },
      });
      expect(body.context.password).toBeUndefined();
      expect(typeof body.timestamp).toBe("string");
    } finally {
      fetchSpy.mockRestore();
      restore();
    }
  });

  it("swallows webhook failures so reporting never breaks the request path", async () => {
    const { mod, restore } = loadWith({ webhook: "https://collector.example/report" });
    const fetchSpy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    try {
      expect(() => mod.captureException(new Error("x"))).not.toThrow();
      // let the rejected promise settle so an unhandled rejection would surface
      await new Promise((r) => setTimeout(r, 10));
    } finally {
      fetchSpy.mockRestore();
      restore();
    }
  });
});

describe("test-environment isolation", () => {
  it("never forwards a report, because the suite pins ERROR_WEBHOOK_URL empty", async () => {
    const { isForwardingEnabled, captureException } = require("../utils/errorReporter");
    expect(process.env.ERROR_WEBHOOK_URL).toBe("");
    expect(isForwardingEnabled()).toBe(false);

    // Any real network attempt would go through fetch; assert none is made.
    const fetchSpy = jest.spyOn(global, "fetch");
    try {
      captureException(new Error("should stay local"), { userId: "u1" });
      await new Promise((r) => setTimeout(r, 10));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
