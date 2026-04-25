import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">The Unsent Archives</Link>

        <nav className="desktop-nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/explore">Explore</NavLink>
          {isAuthenticated && <NavLink to="/library">Library</NavLink>}
          {isAuthenticated && <NavLink to="/analytics">Analytics</NavLink>}
        </nav>

        <div className="topbar-actions">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="ghost-btn">Login</Link>
              <Link to="/register" className="primary-btn">Join</Link>
            </>
          ) : (
            <>
              <Link to={`/profile/${user?.id || ""}`} className="ghost-btn">{user?.username || "Profile"}</Link>
              <button type="button" className="ghost-btn" onClick={onLogout}>Logout</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
