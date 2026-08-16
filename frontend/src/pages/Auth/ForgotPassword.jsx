import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import DoodleBackdrop from "../../components/decor/Doodles";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
      if (data?.resetToken) {
        setDevToken(data.resetToken);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Could not start password reset");
    } finally {
      setLoading(false);
    }
  };

  const resetLink = devToken ? `${window.location.origin}/reset-password?token=${devToken}` : null;

  return (
    <div className="auth-wrap">
      <DoodleBackdrop />

      <form className="auth-card" onSubmit={onSubmit}>
        <span className="auth-eyebrow">Lost your way?</span>
        <h1 className="brand brand-center">The Unsent Archives</h1>
        <h2 className="auth-title">Recover your account</h2>
        <p className="auth-sub">
          Enter the email tied to your archive. We will send a link to set a new password.
        </p>

        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary-btn full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>

        {submitted && (
          <div className="auth-callout">
            <p>
              If an account exists for <strong>{email}</strong>, a reset link has been generated. It
              is valid for 30 minutes.
            </p>
            {resetLink && (
              <>
                <p className="auth-callout-hint">
                  Email delivery is not configured yet, so here is your one-time link:
                </p>
                <Link to={`/reset-password?token=${devToken}`} className="auth-callout-link">
                  Open reset link
                </Link>
                <code className="auth-callout-code">{resetLink}</code>
              </>
            )}
          </div>
        )}

        <p className="auth-foot">
          Remembered it? <Link to="/login">Back to login</Link>
        </p>
      </form>
    </div>
  );
};

export default ForgotPassword;
