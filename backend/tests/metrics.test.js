const { app, request, registerUser, createPost } = require("./helpers/factories");
const {
  registry,
  Counter,
  Histogram,
  httpRequestsTotal,
  normalizeRoute,
  processMetrics,
} = require("../utils/metrics");

describe("Counter", () => {
  it("starts at zero and accumulates per label set", () => {
    const c = new Counter("widgets_total", "Widgets.");
    expect(c.get({ kind: "a" })).toBe(0);

    c.inc({ kind: "a" });
    c.inc({ kind: "a" });
    c.inc({ kind: "b" }, 5);

    expect(c.get({ kind: "a" })).toBe(2);
    expect(c.get({ kind: "b" })).toBe(5);
  });

  it("treats label sets as order-independent", () => {
    const c = new Counter("x_total", "X.");
    c.inc({ a: "1", b: "2" });
    c.inc({ b: "2", a: "1" });
    expect(c.get({ a: "1", b: "2" })).toBe(2);
    expect([...c.samples()]).toHaveLength(1);
  });
});

describe("Histogram", () => {
  it("records sum and count", () => {
    const h = new Histogram("dur_ms", "Duration.", [10, 100]);
    h.observe({ route: "/a" }, 5);
    h.observe({ route: "/a" }, 50);
    expect(h.get({ route: "/a" })).toEqual({ sum: 55, count: 2 });
  });

  it("emits cumulative buckets where each le counts everything at or below it", () => {
    const h = new Histogram("dur_ms", "Duration.", [10, 100, 1000]);
    h.observe({}, 5); // <= 10, 100, 1000
    h.observe({}, 50); // <= 100, 1000
    h.observe({}, 5000); // <= none

    const buckets = [...h.samples()].filter((s) => s.name === "dur_ms_bucket");
    const byLe = Object.fromEntries(buckets.map((b) => [b.labels.le, b.value]));

    expect(byLe[10]).toBe(1);
    expect(byLe[100]).toBe(2);
    expect(byLe[1000]).toBe(2);
    expect(byLe["+Inf"]).toBe(3);
    // buckets must never decrease as le grows
    expect(byLe[10]).toBeLessThanOrEqual(byLe[100]);
    expect(byLe[1000]).toBeLessThanOrEqual(byLe["+Inf"]);
  });

  it("sorts buckets given out of order", () => {
    const h = new Histogram("d", "D.", [100, 10]);
    expect(h.buckets).toEqual([10, 100]);
  });
});

describe("registry.render", () => {
  beforeEach(() => registry.reset());

  it("emits HELP and TYPE headers plus one line per series", () => {
    httpRequestsTotal.inc({ method: "GET", route: "/api/posts", status: 200 });
    const out = registry.render();

    expect(out).toContain("# HELP http_requests_total");
    expect(out).toContain("# TYPE http_requests_total counter");
    expect(out).toContain('http_requests_total{method="GET",route="/api/posts",status="200"} 1');
    expect(out.endsWith("\n")).toBe(true);
  });

  it("escapes quotes and backslashes in label values", () => {
    const c = registry.counter("escaped_total", "Escaping.");
    c.inc({ label: 'a"b\\c' });
    expect(registry.render()).toContain('escaped_total{label="a\\"b\\\\c"} 1');
  });

  it("omits the brace block for unlabelled series", () => {
    const c = registry.counter("bare_total", "Bare.");
    c.inc();
    expect(registry.render()).toContain("\nbare_total 1");
  });

  it("reset clears series but keeps registered metrics", () => {
    httpRequestsTotal.inc({ method: "GET", route: "/x", status: 200 });
    registry.reset();
    expect(httpRequestsTotal.get({ method: "GET", route: "/x", status: 200 })).toBe(0);
    expect(registry.render()).toContain("# TYPE http_requests_total counter");
  });
});

describe("normalizeRoute", () => {
  it("prefers the matched express route over the concrete path", () => {
    expect(normalizeRoute({ baseUrl: "/api/posts", route: { path: "/:id" } })).toBe(
      "/api/posts/:id"
    );
  });

  it("collapses ObjectIds and numeric ids so cardinality stays bounded", () => {
    expect(normalizeRoute({ path: "/api/posts/64b000000000000000000001" })).toBe("/api/posts/:id");
    expect(normalizeRoute({ path: "/api/posts/64b000000000000000000001/comments" })).toBe(
      "/api/posts/:id/comments"
    );
    expect(normalizeRoute({ path: "/api/users/12345/posts" })).toBe("/api/users/:id/posts");
  });

  it("normalises trailing slashes and missing paths to /", () => {
    expect(normalizeRoute({ path: "/api/posts/" })).toBe("/api/posts");
    expect(normalizeRoute({ path: "/" })).toBe("/");
    expect(normalizeRoute({})).toBe("/");
  });
});

describe("processMetrics", () => {
  it("exposes uptime and memory gauges", () => {
    const out = processMetrics();
    expect(out).toMatch(/# TYPE process_uptime_seconds gauge\nprocess_uptime_seconds \d+/);
    expect(out).toMatch(/process_resident_memory_bytes \d+/);
    expect(out).toMatch(/nodejs_heap_used_bytes \d+/);
  });
});

describe("GET /api/metrics", () => {
  beforeEach(() => registry.reset());

  it("exposes the Prometheus exposition format with process gauges", async () => {
    const res = await request(app).get("/api/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.text).toContain("# TYPE http_requests_total counter");
    expect(res.text).toContain("# TYPE http_request_duration_ms histogram");
    expect(res.text).toContain("process_uptime_seconds ");
    expect(res.text).toContain("nodejs_heap_used_bytes ");
  });

  it("counts requests and their latency, labelled by normalised route", async () => {
    const { user } = await registerUser();
    const post = await createPost(user.id);

    await request(app).get(`/api/posts/${post._id}`);
    const res = await request(app).get("/api/metrics");

    // The concrete id must be collapsed so the label set stays bounded.
    expect(res.text).toContain(
      'http_requests_total{method="GET",route="/api/posts/:id",status="200"} 1'
    );
    expect(res.text).toMatch(
      /http_request_duration_ms_count\{method="GET",route="\/api\/posts\/:id"\} 1/
    );
    expect(res.text).not.toContain(String(post._id));
  });

  it("records 4xx responses in the error counter by status class", async () => {
    await request(app).get("/api/posts/000000000000000000000000");
    const res = await request(app).get("/api/metrics");
    expect(res.text).toMatch(/http_request_errors_total\{[^}]*status_class="4xx"\} 1/);
  });
});
