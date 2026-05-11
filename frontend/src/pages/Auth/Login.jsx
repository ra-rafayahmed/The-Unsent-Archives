import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DoodleBackdrop from "../../components/decor/Doodles";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form);
      const redirectPath = location.state?.from?.pathname || "/";
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <DoodleBackdrop />

      <form className="auth-card" onSubmit={onSubmit}>
        <span className="auth-eyebrow">Welcome back, writer</span>
        <h1 className="brand brand-center">The Unsent Archives</h1>
        <h2 className="auth-title">Sign in to your shelf</h2>
        <p className="auth-sub">
          Pick up where you left the bookmark.
        </p>

        <label>
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
          />
        </label>

        <label>
          <span className="label-row">
            <span>Password</span>
            <Link to="/forgot-password" className="label-link">
              Forgot?
            </Link>
          </span>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            placeholder="Your secret line"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary-btn full" disabled={loading}>
          {loading ? "Opening the archive..." : "Sign in"}
        </button>

        <p className="auth-foot">
          New here? <Link to="/register">Start your archive</Link>
        </p>
        <p className="auth-foot">
          Have a backup code? <Link to="/recover">Recover with a code</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
