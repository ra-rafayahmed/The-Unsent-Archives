import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Masonry from "react-masonry-css";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import NoteCard from "../../components/cards/NoteCard";
import ReportDialog from "../../components/ReportDialog";

const UserProfile = ({ own = false }) => {
  const { id } = useParams();
  const { user, updateCurrentUser } = useAuth();
  const userId = own ? user?.id : id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [publicCollections, setPublicCollections] = useState([]);
  const [reporting, setReporting] = useState(false);
  const [form, setForm] = useState({
    bio: "",
    displayName: "",
    avatarUrl: "",
  });
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;

      const [pRes, postRes, colRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/users/${userId}/posts`),
        api.get(`/users/${userId}/collections`),
      ]);

      setProfile(pRes.data.user);
      setPosts(postRes.data.posts || []);
      setPublicCollections(
        (colRes.data.collections || []).filter(
          (c) => c.visibility === "public" || own
        )
      );
      setForm({
        bio: pRes.data.user.bio || "",
        displayName: pRes.data.user.profile?.displayName || "",
        avatarUrl: pRes.data.user.avatarUrl || "",
      });

      if (!own && user?.id && pRes.data.user?._id !== user.id) {
        try {
          const followRes = await api.get(`/users/${userId}/follow/status`);
          setIsFollowing(Boolean(followRes.data.isFollowing));
        } catch {
          setIsFollowing(false);
        }
      }
    };

    load();
  }, [userId, own, user?.id]);

  const deletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    await api.delete(`/posts/${postId}`);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  };

  const saveProfile = async () => {
    if (!userId) return;

    setError("");
    setStatus("");

    try {
      const payload = {
        bio: form.bio,
        avatarUrl: form.avatarUrl,
        profile: {
          ...(profile?.profile || {}),
          displayName: form.displayName,
        },
      };

      const { data } = await api.put(`/users/${userId}`, payload);
      setProfile(data.user);

      if (own) {
        updateCurrentUser(data.user);
      }

      setEditing(false);
      setStatus("Profile updated");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update profile");
    }
  };

  const cancelEdit = () => {
    setForm({
      bio: profile?.bio || "",
      displayName: profile?.profile?.displayName || "",
      avatarUrl: profile?.avatarUrl || "",
    });
    setEditing(false);
    setError("");
    setStatus("");
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setStatus("");
    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/uploads", formData);

      setForm((prev) => ({ ...prev, avatarUrl: data.asset?.url || "" }));
      setStatus("Avatar uploaded. Save profile to apply.");
    } catch (err) {
      setError(err?.response?.data?.message || "Avatar upload failed");
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const toggleFollow = async () => {
    if (!userId || !user?.id || own) return;

    setError("");
    setStatus("");
    setIsFollowLoading(true);

    try {
      if (isFollowing) {
        await api.delete(`/users/${userId}/follow`);
        setIsFollowing(false);
        setProfile((prev) => ({ ...prev, followerCount: Math.max(0, (prev?.followerCount || 0) - 1) }));
        setStatus("Unfollowed");
      } else {
        await api.post(`/users/${userId}/follow`);
        setIsFollowing(true);
        setProfile((prev) => ({ ...prev, followerCount: (prev?.followerCount || 0) + 1 }));
        setStatus("Following");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update follow status");
    } finally {
      setIsFollowLoading(false);
    }
  };

  if (!profile) return <div className="panel">Loading profile...</div>;

  const displayName = profile.profile?.displayName || profile.username;
  const avatar = (editing ? form.avatarUrl : profile.avatarUrl) || "";

  return (
    <section className="profile-layout profile-layout-v2">
      <div>
        <div className="profile-card">
          <div className="profile-card-cover" aria-hidden="true">
            <span className="profile-cover-glyph">❦</span>
          </div>

          <div className="profile-card-body">
            <div className="profile-identity">
              {avatar ? (
                <img src={avatar} alt={displayName} className="profile-avatar profile-avatar-lg" />
              ) : (
                <span className="profile-avatar profile-avatar-lg writer-avatar-fallback">
                  {(displayName || "?")[0].toUpperCase()}
                </span>
              )}

              <div className="profile-id-text">
                <h1 className="profile-name">{displayName}</h1>
                <p className="profile-handle">@{profile.username}</p>
              </div>

              <div className="profile-actions">
                {!own && user?.id && profile?._id !== user.id ? (
                  <>
                    <button
                      type="button"
                      className={isFollowing ? "ghost-btn" : "primary-btn"}
                      onClick={toggleFollow}
                      disabled={isFollowLoading}
                    >
                      {isFollowLoading ? "..." : isFollowing ? "Following" : "Follow"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn small"
                      onClick={() => setReporting(true)}
                    >
                      ⚑ Report
                    </button>
                  </>
                ) : null}
                {own && !editing ? (
                  <button type="button" className="ghost-btn" onClick={() => setEditing(true)}>
                    ✎ Edit profile
                  </button>
                ) : null}
              </div>
            </div>

            <p className="profile-bio">
              {profile.bio || (own ? "Add a bio so readers know whose pages they're turning." : "No bio yet.")}
            </p>

            <div className="profile-stats">
              <div className="profile-stat">
                <span className="profile-stat-num">{posts.length}</span>
                <span className="profile-stat-label">Notes</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-num">{profile.followerCount || 0}</span>
                <span className="profile-stat-label">Followers</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-num">{profile.followingCount || 0}</span>
                <span className="profile-stat-label">Following</span>
              </div>
            </div>

            {own && editing ? (
              <div className="profile-edit-grid panel profile-edit-panel">
                <h3 className="side-title">Edit profile</h3>

                <label>
                  Display name
                  <input
                    value={form.displayName}
                    onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  />
                </label>

                <label>
                  Bio
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                  />
                </label>

                <div className="upload-block">
                  <span className="upload-label">Avatar (JPG / PNG / GIF / WEBP)</span>
                  {form.avatarUrl ? (
                    <div className="upload-preview avatar">
                      <img src={form.avatarUrl} alt="" />
                      <button
                        type="button"
                        className="ghost-btn small upload-clear"
                        onClick={() => setForm((prev) => ({ ...prev, avatarUrl: "" }))}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                  <label className={`dropzone ${isUploadingAvatar ? "is-busy" : ""}`}>
                    <input type="file" accept="image/*,.gif" onChange={uploadAvatar} hidden />
                    <span className="dropzone-icon">📷</span>
                    <span>{isUploadingAvatar ? "Uploading..." : "Drop or pick a portrait"}</span>
                    <span className="dropzone-hint">stored in the archive (max 15MB)</span>
                  </label>
                  <details className="upload-or-url">
                    <summary>or paste a URL</summary>
                    <input
                      type="url"
                      value={form.avatarUrl}
                      onChange={(e) => setForm((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                    />
                  </details>
                </div>

                <div className="row-inline profile-edit-actions">
                  <button type="button" className="primary-btn" onClick={saveProfile}>
                    Save profile
                  </button>
                  <button type="button" className="ghost-btn" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
                {status ? <p className="manuscript-flash">{status}</p> : null}
                {error ? <p className="error">{error}</p> : null}
              </div>
            ) : null}
          </div>
        </div>

        {publicCollections.length > 0 && (
          <>
            <div className="section-rule" aria-hidden="true">
              <span>Public shelves</span>
            </div>
            <div className="shelf-grid">
              {publicCollections.map((c, i) => (
                <Link
                  key={c._id}
                  to={`/collections/${c._id}`}
                  className="shelf-card"
                  style={{ "--shelf-tilt": `${((i % 3) - 1) * 0.6}deg` }}
                >
                  <span className="shelf-spine" aria-hidden="true" />
                  <span className="shelf-tape" aria-hidden="true" />
                  <div className="shelf-card-body">
                    <span className="shelf-eyebrow">
                      {c.visibility === "public" ? "◆ Public shelf" : "◇ Private shelf"}
                    </span>
                    <h3 className="shelf-name">{c.name}</h3>
                    <p className="shelf-count">
                      {c.postCount || 0} {c.postCount === 1 ? "note" : "notes"}
                    </p>
                  </div>
                  <span className="shelf-corner" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="section-rule" aria-hidden="true">
          <span>Notes</span>
        </div>

        {posts.length ? (
          <Masonry breakpointCols={{ default: 3, 1100: 2, 700: 1 }} className="masonry-grid" columnClassName="masonry-col">
            {posts.map((p, i) => (
              <NoteCard key={p._id} post={p} canDelete={own} canEdit={own} onDelete={deletePost} variantSeed={i} />
            ))}
          </Masonry>
        ) : (
          <div className="empty-state">
            <h3>{own ? "No notes yet" : "This shelf is empty"}</h3>
            <p>{own ? "Your unsent words will gather here once you write." : "Check back later — silence is also a draft."}</p>
            {own && (
              <Link to="/write" className="primary-btn">
                Write your first note
              </Link>
            )}
          </div>
        )}
      </div>

      <aside className="side-stack">
        <div className="panel side-panel">
          <h3 className="side-title">Recent themes</h3>
          {(() => {
            const counts = new Map();
            posts.forEach((p) => (p.tagSlugs || []).forEach((s) => counts.set(s, (counts.get(s) || 0) + 1)));
            const recent = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
            return recent.length ? (
              <div className="chip-row">
                {recent.map(([slug, n]) => (
                  <Link
                    key={slug}
                    to={`/explore?q=${encodeURIComponent(slug)}`}
                    className="chip chip-link"
                  >
                    #{slug}
                    <span className="chip-count">{n}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">
                {own
                  ? "Tags from your notes will gather here."
                  : "No themes from this writer yet."}
              </p>
            );
          })()}
        </div>

        <div className="panel side-panel quote-panel">
          <p className="quote-mark">"</p>
          <p className="quote-body">
            {own
              ? "Your archive is a private library, open to the world."
              : `Every page ${displayName} writes is a window left ajar.`}
          </p>
          <span className="quote-attr">— the archivist</span>
        </div>
      </aside>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="user"
        targetId={profile?._id}
        targetLabel={`@${profile?.username}`}
      />
    </section>
  );
};

export default UserProfile;
