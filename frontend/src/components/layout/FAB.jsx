import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const FAB = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <Link to="/write" className="fab" aria-label="Create a new note">
      <span className="material-symbols-outlined">edit</span>
    </Link>
  );
};

export default FAB;
