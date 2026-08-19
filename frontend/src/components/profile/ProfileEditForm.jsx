/**
 * The owner-only edit panel: display name, bio, avatar (upload or pasted URL)
 * and the save/cancel pair. The page owns the form state and passes it back
 * down, so this component never fetches or stores anything itself.
 */
const ProfileEditForm = ({
  form,
  isUploadingAvatar = false,
  onDisplayNameChange,
  onBioChange,
  onAvatarUrlChange,
  onAvatarFileChange,
  onSave,
  onCancel,
}) => {
  return (
    <div className="profile-edit-grid panel profile-edit-panel">
      <h3 className="side-title">Edit profile</h3>

      <label>
        Display name
        <input value={form.displayName} onChange={(e) => onDisplayNameChange(e.target.value)} />
      </label>

      <label>
        Bio
        <textarea value={form.bio} onChange={(e) => onBioChange(e.target.value)} />
      </label>

      <div className="upload-block">
        <span className="upload-label">Avatar (JPG / PNG / GIF / WEBP)</span>
        {form.avatarUrl ? (
          <div className="upload-preview avatar">
            <img src={form.avatarUrl} alt="" />
            <button
              type="button"
              className="ghost-btn small upload-clear"
              onClick={() => onAvatarUrlChange("")}
            >
              Remove
            </button>
          </div>
        ) : null}
        <label className={`dropzone ${isUploadingAvatar ? "is-busy" : ""}`}>
          <input type="file" accept="image/*,.gif" onChange={onAvatarFileChange} hidden />
          <span className="dropzone-icon">📷</span>
          <span>{isUploadingAvatar ? "Uploading..." : "Drop or pick a portrait"}</span>
          <span className="dropzone-hint">stored in the archive (max 15MB)</span>
        </label>
        <details className="upload-or-url">
          <summary>or paste a URL</summary>
          <input
            type="url"
            value={form.avatarUrl}
            onChange={(e) => onAvatarUrlChange(e.target.value)}
          />
        </details>
      </div>

      <div className="row-inline profile-edit-actions">
        <button type="button" className="primary-btn" onClick={onSave}>
          Save profile
        </button>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ProfileEditForm;
