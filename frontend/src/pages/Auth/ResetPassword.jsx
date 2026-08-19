import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import DoodleBackdrop from "../../components/decor/Doodles";
import { toUserMessage } from "../../utils/apiError";
import {
  validateForm,
  validatePassword,
  validatePasswordConfirmation,
} from "../../utils/validation";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateCurrentUser } = useAuth();

  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get("token");
    if (fromQuery) setToken(fromQuery);
  }, [searchParams]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errors = validateForm(
      { password, confirm },
      {
        password: validatePassword,
        confirm: (value, values) => validatePasswordConfirmation(values.password, value),
      }
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      if (data?.token) {
        localStorage.setItem("token", data.token);
        updateCurrentUser?.(data.user);
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(toUserMessage(err, "Could not reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <DoodleBackdrop />

      <form className="auth-card" onSubmit={onSubmit}>
        <span className="auth-eyebrow">A fresh page</span>
        <h1 className="brand brand-center">The Unsent Archives</h1>
        <h2 className="auth-title">Set a new password</h2>
        <p className="auth-sub">
          Pick something memorable. You will be signed in once it is saved.
        </p>

        <label>
          Reset token
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste from your reset link"
          />
        </label>

        <label>
          New password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>
        {fieldErrors.password && <p className="error">{fieldErrors.password}</p>}

        <label>
          Confirm password
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {fieldErrors.confirm && <p className="error">{fieldErrors.confirm}</p>}

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary-btn full" disabled={loading}>
          {loading ? "Saving..." : "Reset password"}
        </button>

        <p className="auth-foot">
          Back to <Link to="/login">login</Link>
        </p>
      </form>
    </div>
  );
};

export default ResetPassword;
