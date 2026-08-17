import { describe, it, expect, afterEach, vi } from "vitest";
import api from "./axios";

/** Re-imports the module so the baseURL is recomputed from the current env. */
const loadFreshApi = async () => {
  vi.resetModules();
  return (await import("./axios")).default;
};

/** Runs the registered request interceptor without touching the network. */
const runRequestInterceptor = (config, instance = api) =>
  instance.interceptors.request.handlers[0].fulfilled(config);

describe("api instance", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the local backend when VITE_API_BASE_URL is not configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const fresh = await loadFreshApi();
    expect(fresh.defaults.baseURL).toBe("http://localhost:5000/api");
  });

  it("uses VITE_API_BASE_URL when it is configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://archives.example.com/api");
    const fresh = await loadFreshApi();
    expect(fresh.defaults.baseURL).toBe("https://archives.example.com/api");
  });

  it("registers exactly one request interceptor", () => {
    expect(api.interceptors.request.handlers.filter(Boolean)).toHaveLength(1);
  });
});

describe("auth request interceptor", () => {
  it("attaches the stored token as a bearer credential", () => {
    localStorage.setItem("token", "t0k3n");
    const config = runRequestInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBe("Bearer t0k3n");
  });

  it("sends no Authorization header when there is no stored token", () => {
    const config = runRequestInterceptor({ headers: {} });
    expect(config.headers).not.toHaveProperty("Authorization");
  });

  it("returns the same config object and leaves other headers untouched", () => {
    localStorage.setItem("token", "t0k3n");
    const input = { url: "/feed", headers: { "Content-Type": "application/json" } };
    const output = runRequestInterceptor(input);

    expect(output).toBe(input);
    expect(output.url).toBe("/feed");
    expect(output.headers["Content-Type"]).toBe("application/json");
    expect(output.headers.Authorization).toBe("Bearer t0k3n");
  });

  it("does not resurrect a token that was cleared on logout", () => {
    localStorage.setItem("token", "t0k3n");
    expect(runRequestInterceptor({ headers: {} }).headers.Authorization).toBe("Bearer t0k3n");

    localStorage.removeItem("token");
    expect(runRequestInterceptor({ headers: {} }).headers).not.toHaveProperty("Authorization");
  });
});
