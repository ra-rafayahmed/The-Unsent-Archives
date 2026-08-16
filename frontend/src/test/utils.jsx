import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * Renders `ui` inside a MemoryRouter at `route`. Pass `path` to mount it
 * as a route element (so useParams / useSearchParams work).
 */
export function renderWithRouter(ui, { route = "/", path = "*" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>
  );
}
