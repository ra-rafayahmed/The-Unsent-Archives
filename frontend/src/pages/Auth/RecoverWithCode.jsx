import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import DoodleBackdrop from "../../components/decor/Doodles";
import { toUserMessage } from "../../utils/apiError";

const RecoverWithCode = () => {
  const navigate = useNavigate();
  const { updateCurrentUser } = useAuth();
  const [form, setForm] = useState({ email: "", code: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/recover", {
        email: form.email,
        code: form.code,
        password: form.password,
      });
      if (data?.token) {
        localStorage.setItem("token", data.token);
        updateCurrentUser?.(data.user);
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(toUserMessage(err, "Recovery failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <DoodleBackdrop />

      <form className="auth-card" onSubmit={onSubmit}>
        <span className="auth-eyebrow">Use a recovery code</span>
        <h1 className="brand brand-center">The Unsent Archives</h1>
        <h2 className="auth-title">Recover with a backup code</h2>
        <p className="auth-sub">
          Enter your email and one of the codes you saved when you joined. It will work once and
          then be retired.
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
          Backup code
          <input
            type="text"
            required
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="xxxx-xxxx-xxxx"
            autoComplete="off"
          />
        </label>

        <label>
          New password
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="At least 6 characters"
          />
        </label>

        <label>
          Confirm password
          <input
            type="password"
            required
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary-btn full" disabled={loading}>
          {loading ? "Recovering..." : "Recover account"}
        </button>

        <p className="auth-foot">
          Lost your codes too? <Link to="/forgot-password">Email a reset link</Link> or contact an
          admin.
        </p>
        <p className="auth-foot">
          Back to <Link to="/login">login</Link>
        </p>
      </form>
    </div>
  );
};

export default RecoverWithCode;
