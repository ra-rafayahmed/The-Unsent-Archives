import { Link } from "react-router-dom";

/**
 * One reply under a note. Anonymous commenters are shown without a profile
 * link; the delete control appears for the comment's author and the note's.
 */
const CommentItem = ({ comment, viewerId, canModerate, onDelete }) => {
  const isAnonComment = comment.isAnonymous;
  const commenterId = comment.userId?._id || comment.userId;
  const commenterName = isAnonComment ? "Anonymous" : comment.userId?.username || "Writer";
  const commenterAvatar = !isAnonComment ? comment.userId?.avatarUrl : null;
  const canDelete =
    viewerId && (canModerate || (commenterId && commenterId.toString() === viewerId));

  return (
    <div className="comment-item manuscript-comment">
      <div className="manuscript-comment-head">
        {commenterAvatar ? (
          <img src={commenterAvatar} alt="" className="nav-avatar" />
        ) : (
          <span className="writer-avatar writer-avatar-fallback">
            {(commenterName || "?")[0].toUpperCase()}
          </span>
        )}
        <div className="manuscript-comment-meta">
          {commenterId && !isAnonComment ? (
            <Link to={`/profile/${commenterId}`} className="manuscript-author-link">
              {commenterName}
            </Link>
          ) : (
            <strong>{commenterName}</strong>
          )}
          {isAnonComment && <span className="manuscript-anon-tag">anonymous</span>}
        </div>
        {canDelete ? (
          <button
            type="button"
            className="manuscript-comment-del"
            onClick={() => onDelete(comment._id)}
            aria-label="Delete comment"
          >
            ×
          </button>
        ) : null}
      </div>
      <p>{comment.text}</p>
    </div>
  );
};

/**
 * The "Letters to the Writer" block: the composer (signed-in only) and the
 * list of replies.
 */
const NoteComments = ({
  comments = [],
  isAuthenticated,
  viewerId,
  canModerate = false,
  draft,
  onDraftChange,
  isAnonymous,
  onAnonymousChange,
  onSubmit,
  onDelete,
}) => {
  return (
    <section className="manuscript-letters">
      <div className="manuscript-letters-head">
        <span className="manuscript-flourish" aria-hidden="true">
          ✒
        </span>
        <h3>Letters to the Writer</h3>
      </div>

      {isAuthenticated ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Write a response..."
            className="manuscript-textarea"
          />
          <div className="manuscript-letter-actions">
            <label className="manuscript-anon">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => onAnonymousChange(e.target.checked)}
              />
              <span>Send anonymously</span>
            </label>
            <button type="button" className="primary-btn" onClick={onSubmit}>
              {isAnonymous ? "Send anonymously" : "Send letter"}
            </button>
          </div>
        </>
      ) : (
        <p className="manuscript-muted">
          <Link to="/login" className="manuscript-author-link">
            Sign in
          </Link>{" "}
          to leave a letter.
        </p>
      )}

      <div className="comment-list">
        {comments.map((c) => (
          <CommentItem
            key={c._id}
            comment={c}
            viewerId={viewerId}
            canModerate={canModerate}
            onDelete={onDelete}
          />
        ))}
        {comments.length === 0 && (
          <p className="manuscript-muted">No letters yet. Be the first to reply.</p>
        )}
      </div>
    </section>
  );
};

export default NoteComments;
