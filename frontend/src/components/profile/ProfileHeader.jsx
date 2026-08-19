/**
 * The identity block at the top of a profile: portrait, name/handle, the
 * viewer's actions (follow + report for visitors, edit for the owner), the
 * bio, and the note/follower/following counts.
 *
 * Purely presentational — the page owns the profile data and the handlers.
 */
const ProfileHeader = ({
  profile,
  displayName,
  avatar,
  postCount,
  own = false,
  viewerId,
  editing = false,
  isFollowing = false,
  isFollowLoading = false,
  onToggleFollow,
  onEdit,
  onReport,
}) => {
  const canFollow = !own && viewerId && profile?._id !== viewerId;

  return (
    <>
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
          {canFollow ? (
            <>
              <button
                type="button"
                className={isFollowing ? "ghost-btn" : "primary-btn"}
                onClick={onToggleFollow}
                disabled={isFollowLoading}
              >
                {isFollowLoading ? "..." : isFollowing ? "Following" : "Follow"}
              </button>
              <button type="button" className="ghost-btn small" onClick={onReport}>
                ⚑ Report
              </button>
            </>
          ) : null}
          {own && !editing ? (
            <button type="button" className="ghost-btn" onClick={onEdit}>
              ✎ Edit profile
            </button>
          ) : null}
        </div>
      </div>

      <p className="profile-bio">
        {profile.bio ||
          (own ? "Add a bio so readers know whose pages they're turning." : "No bio yet.")}
      </p>

      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-num">{postCount}</span>
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
    </>
  );
};

export default ProfileHeader;
