import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reportError, installGlobalErrorHandlers, isReportingEnabled } from "./reportError";

const ENDPOINT = "https://collector.example.com/client-errors";

let consoleError;
let fetchMock;

/** Installs (or removes) a sendBeacon stub — jsdom ships no implementation. */
const setBeacon = (impl) => {
  if (impl) {
    Object.defineProperty(navigator, "sendBeacon", {
      value: impl,
      configurable: true,
      writable: true,
    });
  } else {
    delete navigator.sendBeacon;
  }
};

/** The JSON body of the single POST the reporter made. */
const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_ERROR_ENDPOINT", "");
  setBeacon(null);
});

afterEach(() => {
  consoleError.mockRestore();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setBeacon(null);
});

describe("reportError logging", () => {
  it("always logs, even with no endpoint configured", () => {
    const err = new Error("boom");
    reportError(err, { source: "render" });

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]).toContain(err);
    expect(consoleError.mock.calls[0][0]).toMatch(/Error: boom/);
  });

  it("logs non-Error throwables without choking on them", () => {
    reportError("just a string");
    reportError(undefined);
    reportError({ message: "plain object", name: "WeirdError" });

    expect(consoleError).toHaveBeenCalledTimes(3);
    expect(consoleError.mock.calls[0][0]).toMatch(/just a string/);
    expect(consoleError.mock.calls[1][0]).toMatch(/undefined/);
    expect(consoleError.mock.calls[2][0]).toMatch(/WeirdError: plain object/);
  });
});

describe("reportError transport", () => {
  it("makes no network call when VITE_ERROR_ENDPOINT is unset", () => {
    const beacon = vi.fn(() => true);
    setBeacon(beacon);

    reportError(new Error("boom"), { source: "render" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(isReportingEnabled()).toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("POSTs a sanitised report with the documented JSON shape when the endpoint is set", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    expect(isReportingEnabled()).toBe(true);

    const err = new TypeError("cannot read properties of null");
    reportError(err, { source: "render", componentStack: "\n at HomePage", route: "/explore" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.keepalive).toBe(true);

    const body = sentBody();
    expect(Object.keys(body).sort()).toEqual([
      "app",
      "context",
      "message",
      "name",
      "stack",
      "timestamp",
      "url",
      "userAgent",
    ]);
    expect(body.name).toBe("TypeError");
    expect(body.message).toBe("cannot read properties of null");
    expect(body.stack).toContain("TypeError");
    expect(body.app).toBe("unsent-archives-web");
    expect(body.url).toBe(window.location.href);
    expect(body.userAgent).toBe(navigator.userAgent);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(body.context).toEqual({
      source: "render",
      componentStack: "\n at HomePage",
      route: "/explore",
    });
  });

  it("defaults the route to the current path when the caller does not supply one", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    reportError(new Error("boom"), { source: "window" });

    expect(sentBody().context.route).toBe(window.location.pathname + window.location.search);
  });

  it("prefers sendBeacon when the browser has it", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    const beacon = vi.fn(() => true);
    setBeacon(beacon);

    reportError(new Error("boom"));

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe(ENDPOINT);
    expect(beacon.mock.calls[0][1]).toBeInstanceOf(Blob);
    expect(beacon.mock.calls[0][1].type).toBe("application/json");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to fetch when sendBeacon refuses the payload", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    const beacon = vi.fn(() => false);
    setBeacon(beacon);

    reportError(new Error("boom"));

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("reportError sanitisation", () => {
  it("strips sensitive context keys before sending", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);

    reportError(new Error("boom"), {
      source: "window",
      route: "/login",
      password: "hunter2",
      passwordHash: "$2b$10$abc",
      accessToken: "t0k3n",
      refresh_token: "r3fr3sh",
      Authorization: "Bearer t0k3n",
      cookie: "sid=1",
      jwt: "a.b.c",
      apiKey: "k",
      api_key: "k",
      clientSecret: "shhh",
    });

    const { context } = sentBody();
    expect(context).toEqual({ source: "window", route: "/login" });
    for (const leaked of ["hunter2", "t0k3n", "r3fr3sh", "sid=1", "a.b.c", "shhh"]) {
      expect(fetchMock.mock.calls[0][1].body).not.toContain(leaked);
    }
  });
});

describe("reportError resilience", () => {
  it("never throws when the transport throws synchronously", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    setBeacon(() => {
      throw new Error("beacon exploded");
    });
    fetchMock.mockImplementation(() => {
      throw new Error("fetch exploded");
    });

    expect(() => reportError(new Error("boom"))).not.toThrow();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("never throws when the transport rejects", async () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    fetchMock.mockImplementation(() => Promise.reject(new Error("network down")));

    expect(() => reportError(new Error("boom"))).not.toThrow();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drops a report whose context cannot be serialised instead of throwing", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    const cyclic = { name: "cyclic" };
    cyclic.self = cyclic;

    expect(() => reportError(new Error("boom"), { cyclic })).not.toThrow();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("installGlobalErrorHandlers", () => {
  let uninstall;

  afterEach(() => {
    uninstall?.();
    uninstall = undefined;
  });

  it("reports an uncaught error event", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    uninstall = installGlobalErrorHandlers();

    const error = new Error("uncaught boom");
    window.dispatchEvent(
      new ErrorEvent("error", { error, message: "uncaught boom", filename: "app.js", lineno: 12 })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sentBody();
    expect(body.message).toBe("uncaught boom");
    expect(body.context.source).toBe("window");
    expect(body.context.filename).toBe("app.js");
    expect(body.context.lineno).toBe(12);
  });

  it("reports an unhandled promise rejection", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    uninstall = installGlobalErrorHandlers();

    const event = new Event("unhandledrejection");
    event.reason = new Error("rejected boom");
    window.dispatchEvent(event);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sentBody();
    expect(body.message).toBe("rejected boom");
    expect(body.context.source).toBe("unhandledrejection");
  });

  it("is idempotent: a second install adds no second listener", () => {
    const first = installGlobalErrorHandlers();
    const second = installGlobalErrorHandlers();
    uninstall = first;

    expect(second).toBe(first);

    window.dispatchEvent(new ErrorEvent("error", { error: new Error("once") }));
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("falls back to the event message when the error object is missing", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    uninstall = installGlobalErrorHandlers();

    window.dispatchEvent(new ErrorEvent("error", { message: "script error" }));

    expect(sentBody().message).toBe("script error");
  });

  it("uninstall removes both handlers", () => {
    vi.stubEnv("VITE_ERROR_ENDPOINT", ENDPOINT);
    installGlobalErrorHandlers()();

    // No `error` property: with our listener gone, vitest would otherwise
    // re-throw the attached Error as an uncaught exception.
    window.dispatchEvent(new ErrorEvent("error", { message: "after" }));
    const rejection = new Event("unhandledrejection");
    rejection.reason = new Error("after");
    window.dispatchEvent(rejection);

    expect(consoleError).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can be reinstalled after uninstalling", () => {
    installGlobalErrorHandlers()();
    uninstall = installGlobalErrorHandlers();

    window.dispatchEvent(new ErrorEvent("error", { error: new Error("again") }));
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
