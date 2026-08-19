import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Masonry from "react-masonry-css";
import { useAuth } from "../../context/AuthContext";
import NoteCard from "../../components/cards/NoteCard";
import ReportDialog from "../../components/ReportDialog";
import ProfileHeader from "../../components/profile/ProfileHeader";
import ProfileEditForm from "../../components/profile/ProfileEditForm";
import useUserProfile from "../../hooks/useUserProfile";

const UserProfile = ({ own = false }) => {
  const { id } = useParams();
  const { user, updateCurrentUser } = useAuth();
  const userId = own ? user?.id : id;

  const {
    profile,
    posts,
    collections: publicCollections,
    isFollowing,
    isFollowLoading,
    isUploadingAvatar,
    status,
    error,
    loadError,
    clearMessages,
    deletePost: deletePostById,
    saveProfile: persistProfile,
    uploadAvatar: uploadAvatarFile,
    toggleFollow,
  } = useUserProfile(userId, { own, viewer: user });

  const [reporting, setReporting] = useState(false);
  const [form, setForm] = useState({ bio: "", displayName: "", avatarUrl: "" });
  const [editing, setEditing] = useState(false);

  // Seed the edit form whenever a (new) profile arrives.
  useEffect(() => {
    if (!profile) return;
    setForm({
      bio: profile.bio || "",
      displayName: profile.profile?.displayName || "",
      avatarUrl: profile.avatarUrl || "",
    });
  }, [profile]);

  const deletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    await deletePostById(postId);
  };

  const saveProfile = async () => {
    const updated = await persistProfile(form);
    if (!updated) return;
    if (own) updateCurrentUser(updated);
    setEditing(false);
  };

  const cancelEdit = () => {
    setForm({
      bio: profile?.bio || "",
      displayName: profile?.profile?.displayName || "",
      avatarUrl: profile?.avatarUrl || "",
    });
    setEditing(false);
    clearMessages();
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    const url = await uploadAvatarFile(file);
    if (url) setForm((prev) => ({ ...prev, avatarUrl: url }));
    event.target.value = "";
  };

  if (!profile) {
    return <div className="panel">{loadError ? loadError : "Loading profile..."}</div>;
  }

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
            <ProfileHeader
              profile={profile}
              displayName={displayName}
              avatar={avatar}
              postCount={posts.length}
              own={own}
              viewerId={user?.id}
              editing={editing}
              isFollowing={isFollowing}
              isFollowLoading={isFollowLoading}
              onToggleFollow={toggleFollow}
              onEdit={() => setEditing(true)}
              onReport={() => setReporting(true)}
            />

            {own && editing ? (
              <ProfileEditForm
                form={form}
                isUploadingAvatar={isUploadingAvatar}
                onDisplayNameChange={(value) =>
                  setForm((prev) => ({ ...prev, displayName: value }))
                }
                onBioChange={(value) => setForm((prev) => ({ ...prev, bio: value }))}
                onAvatarUrlChange={(value) => setForm((prev) => ({ ...prev, avatarUrl: value }))}
                onAvatarFileChange={uploadAvatar}
                onSave={saveProfile}
                onCancel={cancelEdit}
              />
            ) : null}

            {status ? <p className="manuscript-flash">{status}</p> : null}
            {error ? <p className="error">{error}</p> : null}
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
          <Masonry
            breakpointCols={{ default: 3, 1100: 2, 700: 1 }}
            className="masonry-grid"
            columnClassName="masonry-col"
          >
            {posts.map((p, i) => (
              <NoteCard
                key={p._id}
                post={p}
                canDelete={own}
                canEdit={own}
                onDelete={deletePost}
                variantSeed={i}
              />
            ))}
          </Masonry>
        ) : (
          <div className="empty-state">
            <h3>{own ? "No notes yet" : "This shelf is empty"}</h3>
            <p>
              {own
                ? "Your unsent words will gather here once you write."
                : "Check back later — silence is also a draft."}
            </p>
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
            posts.forEach((p) =>
              (p.tagSlugs || []).forEach((s) => counts.set(s, (counts.get(s) || 0) + 1))
            );
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
                {own ? "Tags from your notes will gather here." : "No themes from this writer yet."}
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
