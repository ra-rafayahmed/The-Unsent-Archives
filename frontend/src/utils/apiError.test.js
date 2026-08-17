import { describe, it, expect } from "vitest";
import {
  getStatus,
  isNetworkError,
  isUnauthorized,
  isForbidden,
  isNotFound,
  isServerError,
  toUserMessage,
  toApiError,
} from "./apiError";

const httpError = (status, message) => ({
  response: { status, data: message === undefined ? {} : { message } },
});

describe("status helpers", () => {
  it("reads the status off an axios-shaped error", () => {
    expect(getStatus(httpError(404))).toBe(404);
    expect(isUnauthorized(httpError(401))).toBe(true);
    expect(isForbidden(httpError(403))).toBe(true);
    expect(isNotFound(httpError(404))).toBe(true);
    expect(isServerError(httpError(500))).toBe(true);
    expect(isServerError(httpError(499))).toBe(false);
  });

  it("reports 0 and network-error for a request that never got a response", () => {
    const err = new Error("Network Error");
    expect(getStatus(err)).toBe(0);
    expect(isNetworkError(err)).toBe(true);
    expect(isNetworkError(httpError(500))).toBe(false);
  });

  it("treats a missing error as neither network nor server failure", () => {
    expect(isNetworkError(undefined)).toBe(false);
    expect(getStatus(null)).toBe(0);
  });
});

describe("toUserMessage", () => {
  it("prefers the API's own message and trims it", () => {
    expect(toUserMessage(httpError(409, "  Email is already registered  "))).toBe(
      "Email is already registered"
    );
  });

  it("ignores a blank or non-string API message", () => {
    expect(toUserMessage(httpError(400, "   "), "fallback here")).toBe("fallback here");
    expect(toUserMessage({ response: { status: 400, data: { message: 42 } } }, "fallback")).toBe(
      "fallback"
    );
  });

  it("explains a network failure rather than blaming the user", () => {
    expect(toUserMessage(new Error("Network Error"))).toMatch(/Cannot reach the server/);
  });

  it("has a sensible default per status", () => {
    expect(toUserMessage(httpError(401))).toMatch(/sign in/i);
    expect(toUserMessage(httpError(403))).toMatch(/do not have access/i);
    expect(toUserMessage(httpError(404))).toMatch(/no longer here/i);
    expect(toUserMessage(httpError(409))).toMatch(/conflicts/i);
    expect(toUserMessage(httpError(413))).toMatch(/too large/i);
    expect(toUserMessage(httpError(429))).toMatch(/Too many attempts/i);
    expect(toUserMessage(httpError(503))).toMatch(/server had a problem/i);
  });

  it("uses the caller's fallback for unremarkable client errors", () => {
    expect(toUserMessage(httpError(400), "Could not save the note")).toBe(
      "Could not save the note"
    );
  });

  it("has a generic default when the caller gives no fallback", () => {
    expect(toUserMessage(httpError(400))).toBe("Something went wrong. Please try again.");
  });
});

describe("toApiError", () => {
  it("bundles the message with the classification flags", () => {
    expect(toApiError(httpError(500, "boom"))).toEqual({
      message: "boom",
      status: 500,
      isNetwork: false,
      isServer: true,
    });
  });

  it("classifies a network error", () => {
    const out = toApiError(new Error("Network Error"));
    expect(out).toMatchObject({ status: 0, isNetwork: true, isServer: false });
    expect(out.message).toMatch(/Cannot reach the server/);
  });
});
