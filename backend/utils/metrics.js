// Minimal, dependency-free metrics registry with Prometheus text exposition.
//
// Deliberately small: this service needs request/error counters and latency
// buckets for a /api/metrics scrape, not a full client library. Everything is
// in-process and resets on restart, which is what a scraper expects.

const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

/** Serialise a label object into Prometheus `{a="1",b="2"}` form. */
const formatLabels = (labels) => {
  const entries = Object.entries(labels).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return "";
  const inner = entries
    .map(([k, v]) => `${k}="${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
  return `{${inner}}`;
};

/** Stable key for a label set so the same labels always hit the same series. */
const labelKey = (labels) =>
  JSON.stringify(
    Object.keys(labels)
      .sort()
      .map((k) => [k, labels[k]])
  );

class Counter {
  constructor(name, help) {
    this.name = name;
    this.help = help;
    this.type = "counter";
    this.series = new Map();
  }

  inc(labels = {}, value = 1) {
    const key = labelKey(labels);
    const existing = this.series.get(key);
    if (existing) existing.value += value;
    else this.series.set(key, { labels, value });
  }

  get(labels = {}) {
    return this.series.get(labelKey(labels))?.value ?? 0;
  }

  *samples() {
    for (const { labels, value } of this.series.values()) {
      yield { name: this.name, labels, value };
    }
  }
}

class Histogram {
  constructor(name, help, buckets = DURATION_BUCKETS_MS) {
    this.name = name;
    this.help = help;
    this.type = "histogram";
    this.buckets = [...buckets].sort((a, b) => a - b);
    this.series = new Map();
  }

  observe(labels = {}, value = 0) {
    const key = labelKey(labels);
    let s = this.series.get(key);
    if (!s) {
      s = { labels, counts: new Array(this.buckets.length).fill(0), sum: 0, count: 0 };
      this.series.set(key, s);
    }
    s.sum += value;
    s.count += 1;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) s.counts[i] += 1;
    }
  }

  get(labels = {}) {
    const s = this.series.get(labelKey(labels));
    return s ? { sum: s.sum, count: s.count } : { sum: 0, count: 0 };
  }

  *samples() {
    for (const s of this.series.values()) {
      // counts[i] is already cumulative: observe() bumps every bucket whose
      // upper bound the value fits under, which is what `le` means.
      for (let i = 0; i < this.buckets.length; i++) {
        yield {
          name: `${this.name}_bucket`,
          labels: { ...s.labels, le: this.buckets[i] },
          value: s.counts[i],
        };
      }
      yield { name: `${this.name}_bucket`, labels: { ...s.labels, le: "+Inf" }, value: s.count };
      yield { name: `${this.name}_sum`, labels: s.labels, value: s.sum };
      yield { name: `${this.name}_count`, labels: s.labels, value: s.count };
    }
  }
}

class Registry {
  constructor() {
    this.metrics = new Map();
  }

  counter(name, help) {
    if (!this.metrics.has(name)) this.metrics.set(name, new Counter(name, help));
    return this.metrics.get(name);
  }

  histogram(name, help, buckets) {
    if (!this.metrics.has(name)) this.metrics.set(name, new Histogram(name, help, buckets));
    return this.metrics.get(name);
  }

  /** Drop every recorded series (used by tests). */
  reset() {
    for (const m of this.metrics.values()) m.series.clear();
  }

  /** Prometheus text exposition format (version 0.0.4). */
  render() {
    const lines = [];
    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      for (const s of metric.samples()) {
        lines.push(`${s.name}${formatLabels(s.labels)} ${s.value}`);
      }
    }
    return `${lines.join("\n")}\n`;
  }
}

const registry = new Registry();

// --- Application metrics ----------------------------------------------------
const httpRequestsTotal = registry.counter(
  "http_requests_total",
  "Total HTTP requests by method, route and status code."
);
const httpRequestErrorsTotal = registry.counter(
  "http_request_errors_total",
  "HTTP responses with a 4xx or 5xx status, by method, route and status class."
);
const httpRequestDurationMs = registry.histogram(
  "http_request_duration_ms",
  "HTTP request duration in milliseconds by method and route."
);
const unhandledErrorsTotal = registry.counter(
  "unhandled_errors_total",
  "Errors reaching the global error handler, by error name."
);

/**
 * Collapse a request path into a low-cardinality route label. Mongo ObjectIds
 * and other long ids become `:id` so the metric does not explode per resource.
 */
const normalizeRoute = (req) => {
  const raw = req.route?.path && req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.path || "/";
  return (
    raw
      .replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, "/:id")
      .replace(/\/\d+(?=\/|$)/g, "/:id")
      .replace(/\/+$/, "") || "/"
  );
};

/** Process-level gauges, sampled at scrape time rather than stored. */
const processMetrics = () => {
  const mem = process.memoryUsage();
  return [
    "# HELP process_uptime_seconds Seconds since the process started.",
    "# TYPE process_uptime_seconds gauge",
    `process_uptime_seconds ${Math.round(process.uptime())}`,
    "# HELP process_resident_memory_bytes Resident set size in bytes.",
    "# TYPE process_resident_memory_bytes gauge",
    `process_resident_memory_bytes ${mem.rss}`,
    "# HELP nodejs_heap_used_bytes V8 heap actually used, in bytes.",
    "# TYPE nodejs_heap_used_bytes gauge",
    `nodejs_heap_used_bytes ${mem.heapUsed}`,
    "",
  ].join("\n");
};

module.exports = {
  registry,
  Counter,
  Histogram,
  httpRequestsTotal,
  httpRequestErrorsTotal,
  httpRequestDurationMs,
  unhandledErrorsTotal,
  normalizeRoute,
  processMetrics,
  DURATION_BUCKETS_MS,
};
