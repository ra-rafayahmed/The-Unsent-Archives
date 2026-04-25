import { NavLink } from "react-router-dom";

const MobileNav = () => {
  return (
    <nav className="mobile-nav">
      <NavLink to="/" end>
        <span className="material-symbols-outlined">home</span>
        Home
      </NavLink>
      <NavLink to="/explore">
        <span className="material-symbols-outlined">search</span>
        Explore
      </NavLink>
      <NavLink to="/library">
        <span className="material-symbols-outlined">collections_bookmark</span>
        Library
      </NavLink>
      <NavLink to="/profile">
        <span className="material-symbols-outlined">person</span>
        Profile
      </NavLink>
    </nav>
  );
};

export default MobileNav;
