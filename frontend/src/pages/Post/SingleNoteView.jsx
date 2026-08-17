import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { getPostTextStyle } from "../../utils/postStyle";
import ReportDialog from "../../components/ReportDialog";
import { buildNoteTheme } from "../../utils/color";
import usePost from "../../hooks/usePost";
import { toUserMessage } from "../../utils/apiError";

const SingleNoteView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const audioRef = useRef(null);
  const {
    post,
    reactions,
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
    isFollowing,
    setIsFollowing,
    loadError,
    reloadPost,
    reloadReactions,
  } = usePost(id, user);
  const [commentsText, setCommentsText] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const image = useMemo(() => post?.media?.find((m) => m.type === "image"), [post]);
  const audio = useMemo(() => post?.media?.find((m) => m.type === "audio"), [post]);

  const spotifyTrackId = useMemo(() => {
    if (!audio?.url) return null;
    const match = audio.url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/i);
    return match?.[1] || null;
  }, [audio]);

  const canDelete = useMemo(() => {
    if (!post || !user) return false;
    return isAdmin || post.authorId?._id === user.id;
  }, [post, user, isAdmin]);

  const canEdit = useMemo(() => {
    if (!post || !user) return false;
    return post.authorId?._id === user.id;
  }, [post, user]);

  const postTextStyle = useMemo(() => getPostTextStyle(post?.style || {}), [post]);

  const { isDark: isDarkTheme, vars: themeVars } = useMemo(
    () => buildNoteTheme(post?.style?.background, post?.style?.textColor),
    [post?.style?.background, post?.style?.textColor]
  );

  useEffect(() => {
    if (!audioRef.current || spotifyTrackId) return;

    const playPromise = audioRef.current.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        setStatus("Tap play if autoplay is blocked by your browser");
      });
    }
  }, [audio?.url, spotifyTrackId]);

  // Apply the per-note CSS variables to <html> so the full-viewport gradient
  // (painted on body::after via :has()) can read them. Cleared on unmount so
  // other pages aren't stuck with the last note's palette.
  useEffect(() => {
    const el = document.documentElement;
    const keys = Object.keys(themeVars);
    keys.forEach((k) => el.style.setProperty(k, themeVars[k]));
    return () => {
      keys.forEach((k) => el.style.removeProperty(k));
    };
  }, [themeVars]);

  const react = async (type) => {
    setError("");
    setStatus("");

    try {
      await api.post(`/posts/${id}/reactions`, { type });
      await reloadReactions();
    } catch (err) {
      setError(toUserMessage(err, "Could not update reaction"));
    }
  };

  const comment = async () => {
    if (!commentsText.trim()) return;
    setError("");

    try {
      await api.post(`/posts/${id}/comments`, {
        text: commentsText.trim(),
        isAnonymous: commentAnon,
      });
      setCommentsText("");
      setCommentAnon(false);
      await reloadPost();
    } catch (err) {
      setError(toUserMessage(err, "Could not add comment"));
    }
  };

  const deleteCommentById = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    setError("");
    try {
      await api.delete(`/posts/${id}/comments/${commentId}`);
      await reloadPost();
    } catch (err) {
      setError(toUserMessage(err, "Could not delete comment"));
    }
  };

  const saveToCollection = async () => {
    if (!selectedCollectionId) return;
    setError("");
    setStatus("");

    try {
      await api.post(`/collections/${selectedCollectionId}/posts`, { postId: id });
      setStatus("Saved to collection");
    } catch (err) {
      setError(toUserMessage(err, "Could not save post to collection"));
    }
  };

  const toggleFollow = async () => {
    if (!post?.authorId?._id || post?.isAnonymous || !user?.id || post.authorId._id === user.id)
      return;

    setError("");
    setStatus("");
    setIsFollowLoading(true);

    try {
      if (isFollowing) {
        await api.delete(`/users/${post.authorId._id}/follow`);
        setIsFollowing(false);
      } else {
        await api.post(`/users/${post.authorId._id}/follow`);
        setIsFollowing(true);
      }
    } catch (err) {
      setError(toUserMessage(err, "Could not update follow status"));
    } finally {
      setIsFollowLoading(false);
    }
  };

  const deletePost = async () => {
    if (!window.confirm("Delete this post?")) return;

    if (isAdmin && post.authorId?._id !== user?.id) {
      await api.delete(`/admin/posts/${post._id}`);
    } else {
      await api.delete(`/posts/${post._id}`);
    }

    navigate("/");
  };

  if (!post) {
    return <div className="panel">{loadError ? loadError : "Loading note..."}</div>;
  }

  const visibleAuthorName = post?.isAnonymous ? "Anonymous" : post?.authorId?.username;
  const visibleAuthorId = post?.isAnonymous ? null : post?.authorId?._id;

  return (
    <section
      className={`note-shell ${isDarkTheme ? "is-dark" : "is-light"}`}
      data-theme={isDarkTheme ? "dark" : "light"}
      style={themeVars}
    >
      <article className={`note-manuscript ${isDarkTheme ? "note-theme-dark" : ""}`}>
        <header className="manuscript-head">
          <span className="manuscript-flourish" aria-hidden="true">
            ❦
          </span>
          <div className="manuscript-author">
            {visibleAuthorId ? (
              <>
                <Link to={`/profile/${visibleAuthorId}`} className="manuscript-author-link">
                  @{visibleAuthorName}
                </Link>
                {user?.id && visibleAuthorId !== user.id ? (
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={toggleFollow}
                    disabled={isFollowLoading}
                  >
                    {isFollowLoading ? "..." : isFollowing ? "Following" : "Follow"}
                  </button>
                ) : null}
              </>
            ) : (
              <span className="manuscript-author-link">{visibleAuthorName || "Writer"}</span>
            )}
          </div>
          <span className="manuscript-flourish" aria-hidden="true">
            ❦
          </span>
        </header>

        {image ? (
          <figure className="manuscript-image">
            <img src={image.url} alt="Note media" />
          </figure>
        ) : null}

        <div className="manuscript-body" style={postTextStyle}>
          {post.content}
        </div>

        {(post.tagSlugs || []).length > 0 && (
          <div className="manuscript-tags">
            {post.tagSlugs.map((tag) => (
              <span key={tag} className="chip note-chip">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {audio ? (
          <div className="manuscript-audio">
            {spotifyTrackId ? (
              <iframe
                title="Spotify track"
                src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator`}
                width="100%"
                height="80"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : (
              <audio ref={audioRef} controls autoPlay src={audio.url} className="single-audio" />
            )}
          </div>
        ) : null}

        <div className="manuscript-rule" aria-hidden="true" />

        <div className="reaction-strip manuscript-reactions">
          {[
            ["like", "❤", "Love"],
            ["love", "🫂", "Felt"],
            ["sad", "💧", "Cried"],
            ["wow", "✨", "Wow"],
          ].map(([type, glyph, label]) => (
            <button key={type} type="button" className="reaction-chip" onClick={() => react(type)}>
              <span className="reaction-glyph" aria-hidden="true">
                {glyph}
              </span>
              <span>{label}</span>
              <span className="reaction-count">{reactions[type] || 0}</span>
            </button>
          ))}
        </div>

        {(canEdit || canDelete || isAuthenticated) && (
          <div className="manuscript-toolbar">
            {isAuthenticated && collections.length > 0 ? (
              <>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="manuscript-select"
                >
                  {collections.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="manuscript-toolbar-btn" onClick={saveToCollection}>
                  ✦ Save
                </button>
              </>
            ) : null}
            {canEdit ? (
              <Link to={`/write/${post._id}`} className="manuscript-toolbar-btn">
                ✎ Edit
              </Link>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="manuscript-toolbar-btn is-danger"
                onClick={deletePost}
              >
                🗑 Delete
              </button>
            ) : null}
            {isAuthenticated && !canEdit ? (
              <button
                type="button"
                className="manuscript-toolbar-btn"
                onClick={() => setReporting(true)}
              >
                ⚑ Report
              </button>
            ) : null}
          </div>
        )}

        {status ? <p className="manuscript-flash">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}

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
                value={commentsText}
                onChange={(e) => setCommentsText(e.target.value)}
                placeholder="Write a response..."
                className="manuscript-textarea"
              />
              <div className="manuscript-letter-actions">
                <label className="manuscript-anon">
                  <input
                    type="checkbox"
                    checked={commentAnon}
                    onChange={(e) => setCommentAnon(e.target.checked)}
                  />
                  <span>Send anonymously</span>
                </label>
                <button type="button" className="primary-btn" onClick={comment}>
                  {commentAnon ? "Send anonymously" : "Send letter"}
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
            {(post.comments || []).map((c) => {
              const isAnonComment = c.isAnonymous;
              const commenterId = c.userId?._id || c.userId;
              const commenterName = isAnonComment ? "Anonymous" : c.userId?.username || "Writer";
              const commenterAvatar = !isAnonComment ? c.userId?.avatarUrl : null;
              const canDeleteComment =
                user?.id && (canEdit || (commenterId && commenterId.toString() === user.id));

              return (
                <div key={c._id} className="comment-item manuscript-comment">
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
                    {canDeleteComment ? (
                      <button
                        type="button"
                        className="manuscript-comment-del"
                        onClick={() => deleteCommentById(c._id)}
                        aria-label="Delete comment"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  <p>{c.text}</p>
                </div>
              );
            })}
            {(post.comments || []).length === 0 && (
              <p className="manuscript-muted">No letters yet. Be the first to reply.</p>
            )}
          </div>
        </section>
      </article>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="post"
        targetId={post?._id}
        targetLabel={(post?.content || "").slice(0, 80)}
      />
    </section>
  );
};

export default SingleNoteView;
