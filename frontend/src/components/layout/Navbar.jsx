import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
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
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>

        <div className="topbar-actions">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="ghost-btn">Login</Link>
              <Link to="/register" className="primary-btn">Join</Link>
            </>
          ) : (
            <>
              <Link to="/profile" className="ghost-btn nav-profile-link">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="nav-avatar" /> : null}
                {user?.username || "Profile"}
              </Link>
              <button type="button" className="ghost-btn" onClick={onLogout}>Logout</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
