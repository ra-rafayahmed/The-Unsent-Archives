import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./Navbar";
import MobileNav from "./MobileNav";
import FAB from "./FAB";
import AmbientDoodles from "../decor/AmbientDoodles";

const RootLayout = () => {
  const location = useLocation();

  // Scroll to top on route change so the page-fade animation feels right.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <AmbientDoodles />
      <Navbar />
      <main className="page-shell" key={location.pathname}>
        <div className="page-fade">
          <Outlet />
        </div>
      </main>
      <FAB />
      <MobileNav />
    </div>
  );
};

export default RootLayout;
