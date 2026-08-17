import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom has no layout engine, so window.scrollTo logs "Not implemented" every
// time a component calls it. Tests that care about scrolling spy on this stub.
if (!vi.isMockFunction(window.scrollTo)) {
  window.scrollTo = vi.fn();
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
