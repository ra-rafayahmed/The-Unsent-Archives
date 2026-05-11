import { useState } from "react";
import api from "../api/axios";

const REASONS = [
  { id: "spam", label: "Spam or scam" },
  { id: "harassment", label: "Harassment / bullying" },
  { id: "hate", label: "Hate speech" },
  { id: "self-harm", label: "Self-harm / dangerous content" },
  { id: "nsfw", label: "Sexual / NSFW content" },
  { id: "impersonation", label: "Impersonation" },
  { id: "other", label: "Something else" },
];

const ReportDialog = ({ open, onClose, targetType, targetId, targetLabel }) => {
  const [reason, setReason] = useState("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/reports", { targetType, targetId, reason, note });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not file report");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setReason("spam");
    setNote("");
    setError("");
    setDone(false);
    onClose?.();
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <form
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3>Report {targetType === "user" ? "this writer" : "this note"}</h3>
        {targetLabel ? <p className="muted">{targetLabel}</p> : null}

        {done ? (
          <>
            <p className="manuscript-flash">
              Thank you. An admin will review this shortly.
            </p>
            <div className="row-inline" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="primary-btn" onClick={close}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <label>
              Reason
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Optional note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context if it helps the moderators..."
                maxLength={500}
              />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <div className="row-inline" style={{ justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="ghost-btn" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={busy}>
                {busy ? "Sending..." : "Submit report"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default ReportDialog;
