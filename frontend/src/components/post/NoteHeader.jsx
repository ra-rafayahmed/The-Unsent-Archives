import { Link } from "react-router-dom";

/**
 * The manuscript header of a note: flourishes around the writer's name.
 * Anonymous notes render the name as plain text (no profile link, no follow);
 * signed-in readers looking at someone else's note also get the follow toggle.
 */
const NoteHeader = ({
  authorId,
  authorName,
  viewerId,
  isFollowing,
  isFollowLoading = false,
  onToggleFollow,
}) => {
  return (
    <header className="manuscript-head">
      <span className="manuscript-flourish" aria-hidden="true">
        ❦
      </span>
      <div className="manuscript-author">
        {authorId ? (
          <>
            <Link to={`/profile/${authorId}`} className="manuscript-author-link">
              @{authorName}
            </Link>
            {viewerId && authorId !== viewerId ? (
              <button
                type="button"
                className="ghost-btn small"
                onClick={onToggleFollow}
                disabled={isFollowLoading}
              >
                {isFollowLoading ? "..." : isFollowing ? "Following" : "Follow"}
              </button>
            ) : null}
          </>
        ) : (
          <span className="manuscript-author-link">{authorName || "Writer"}</span>
        )}
      </div>
      <span className="manuscript-flourish" aria-hidden="true">
        ❦
      </span>
    </header>
  );
};

export default NoteHeader;
