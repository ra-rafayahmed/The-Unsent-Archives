import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import MobileNav from "./MobileNav";
import FAB from "./FAB";

const RootLayout = () => {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-shell">
        <Outlet />
      </main>
      <FAB />
      <MobileNav />
    </div>
  );
};

export default RootLayout;
