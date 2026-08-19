import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DoodleBackdrop from "../../components/decor/Doodles";
import { toUserMessage } from "../../utils/apiError";
import {
  validateForm,
  validateUsername,
  validateEmail,
  validatePassword,
} from "../../utils/validation";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errors = validateForm(form, {
      username: validateUsername,
      email: validateEmail,
      password: validatePassword,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      const data = await register(form);
      if (data?.backupCodes) {
        setBackupCodes(data.backupCodes);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(toUserMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const copyCodes = async () => {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
    } catch {
      // clipboard unavailable — user can still download the codes
    }
  };

  const downloadCodes = () => {
    if (!backupCodes) return;
    const blob = new Blob(
      [
        "The Unsent Archives — Account Recovery Codes\n",
        `Username: ${form.username}\n`,
        `Generated: ${new Date().toLocaleString()}\n\n`,
        backupCodes.map((c, i) => `${String(i + 1).padStart(2, "0")}.  ${c}`).join("\n"),
        "\n\nKeep these somewhere safe. Each code works once.\n",
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unsent-archives-backup-codes-${form.username}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (backupCodes) {
    return (
      <div className="auth-wrap">
        <DoodleBackdrop />
        <div className="auth-card">
          <span className="auth-eyebrow">Save these codes</span>
          <h1 className="brand brand-center">The Unsent Archives</h1>
          <h2 className="auth-title">Your recovery codes</h2>
          <p className="auth-sub">
            If you ever lose your password <strong>and</strong> can't access your email, any one of
            these codes recovers your account. We only show them once.
          </p>

          <div className="backup-grid">
            {backupCodes.map((c, i) => (
              <code key={c} className="backup-code">
                <span className="backup-code-i">{i + 1}.</span> {c}
              </code>
            ))}
          </div>

          <div className="row-inline" style={{ justifyContent: "center", gap: "0.5rem" }}>
            <button type="button" className="ghost-btn" onClick={copyCodes}>
              Copy
            </button>
            <button type="button" className="ghost-btn" onClick={downloadCodes}>
              Download .txt
            </button>
          </div>

          <label className="manuscript-anon" style={{ justifyContent: "center" }}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>I have saved these codes somewhere safe</span>
          </label>

          <button
            type="button"
            className="primary-btn full"
            disabled={!acknowledged}
            onClick={() => navigate("/")}
          >
            Continue to my archive
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <DoodleBackdrop />

      <form className="auth-card" onSubmit={onSubmit}>
        <span className="auth-eyebrow">Open a fresh notebook</span>
        <h1 className="brand brand-center">The Unsent Archives</h1>
        <h2 className="auth-title">Create your writer profile</h2>
        <p className="auth-sub">A quiet shelf for everything you never got to send.</p>

        <label>
          Pen name
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="e.g. midnight_pen"
          />
        </label>
        {fieldErrors.username && <p className="error">{fieldErrors.username}</p>}

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
        {fieldErrors.email && <p className="error">{fieldErrors.email}</p>}

        <label>
          Password
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="At least 6 characters"
          />
        </label>
        {fieldErrors.password && <p className="error">{fieldErrors.password}</p>}

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary-btn full" disabled={loading}>
          {loading ? "Stitching your shelf..." : "Begin writing"}
        </button>

        <p className="auth-foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
