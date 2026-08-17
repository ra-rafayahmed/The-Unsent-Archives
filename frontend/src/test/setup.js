import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// findBy*/waitFor default to 1s, which is not enough on a cold CI runner when
// the assertion is waiting on a React.lazy chunk import. The suite's own
// testTimeout is 15s, so give the async helpers room inside it.
configure({ asyncUtilTimeout: 8000 });

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
