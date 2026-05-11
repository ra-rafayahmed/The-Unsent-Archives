import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { getPostTextStyle } from "../../utils/postStyle";
import ReportDialog from "../../components/ReportDialog";

const hexToRgb = (hex = "") => {
  const v = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
};

const getLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
};

const lighten = (hex, amount) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const m = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(rgb.r)}, ${m(rgb.g)}, ${m(rgb.b)})`;
};

const darken = (hex, amount) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const m = (c) => Math.round(c * (1 - amount));
  return `rgb(${m(rgb.r)}, ${m(rgb.g)}, ${m(rgb.b)})`;
};

const rgba = (hex, a) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${a})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
};

const SingleNoteView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const audioRef = useRef(null);
  const [post, setPost] = useState(null);
  const [commentsText, setCommentsText] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);
  const [reactions, setReactions] = useState({});
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const loadPost = async () => {
    const { data } = await api.get(`/posts/${id}`);
    setPost(data.post);
  };

  const loadReactions = async () => {
    const { data } = await api.get(`/posts/${id}/reactions`);
    setReactions(data.reactions || {});
  };

  const loadCollections = async () => {
    if (!user?.id) return;

    const { data } = await api.get(`/users/${user.id}/collections`);
    const rows = data.collections || [];
    setCollections(rows);
    if (rows.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(rows[0]._id);
    }
  };

  useEffect(() => {
    loadPost();
    loadReactions();
    api.post("/events", { type: "view", postId: id }).catch(() => {});
  }, [id]);

  useEffect(() => {
    loadCollections().catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const loadFollowStatus = async () => {
      if (!user?.id || !post?.authorId?._id || post?.isAnonymous || post.authorId._id === user.id) {
        setIsFollowing(false);
        return;
      }

      try {
        const { data } = await api.get(`/users/${post.authorId._id}/follow/status`);
        setIsFollowing(Boolean(data.isFollowing));
      } catch {
        setIsFollowing(false);
      }
    };

    loadFollowStatus();
  }, [post?.authorId?._id, post?.isAnonymous, user?.id]);

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

  const noteBg = post?.style?.background || "#fbf6e9";
  const isDarkTheme = useMemo(() => getLuminance(noteBg) < 0.4, [noteBg]);

  const themeVars = useMemo(() => {
    const text = post?.style?.textColor || (isDarkTheme ? "#f5ecd8" : "#1c130a");
    return {
      "--note-bg": noteBg,
      "--note-text": text,
      "--note-surface": isDarkTheme ? lighten(noteBg, 0.06) : darken(noteBg, 0.03),
      "--note-surface-soft": isDarkTheme ? lighten(noteBg, 0.12) : darken(noteBg, 0.06),
      "--note-border": isDarkTheme ? rgba("#ffffff", 0.12) : rgba("#000000", 0.1),
      "--note-muted": isDarkTheme ? rgba("#f5ecd8", 0.62) : rgba("#1c130a", 0.55),
      "--note-accent": isDarkTheme ? "#e7b35a" : "#9a3412",
      "--note-glow-a": isDarkTheme ? rgba(noteBg, 0.55) : rgba("#f1c97a", 0.45),
      "--note-glow-b": isDarkTheme ? rgba("#e7b35a", 0.18) : rgba("#d2521a", 0.18),
    };
  }, [noteBg, isDarkTheme, post?.style?.textColor]);

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
      await loadReactions();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update reaction");
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
      await loadPost();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not add comment");
    }
  };

  const deleteCommentById = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    setError("");
    try {
      await api.delete(`/posts/${id}/comments/${commentId}`);
      await loadPost();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not delete comment");
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
      setError(err?.response?.data?.message || "Could not save post to collection");
    }
  };

  const toggleFollow = async () => {
    if (!post?.authorId?._id || post?.isAnonymous || !user?.id || post.authorId._id === user.id) return;

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
      setError(err?.response?.data?.message || "Could not update follow status");
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

  if (!post) return <div className="panel">Loading note...</div>;

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
          <span className="manuscript-flourish" aria-hidden="true">❦</span>
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
          <span className="manuscript-flourish" aria-hidden="true">❦</span>
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
              <span key={tag} className="chip note-chip">#{tag}</span>
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
              <span className="reaction-glyph" aria-hidden="true">{glyph}</span>
              <span>{label}</span>
              <span className="reaction-count">{reactions[type] || 0}</span>
            </button>
          ))}
        </div>

        {(canEdit || canDelete || (isAuthenticated && collections.length > 0)) && (
          <div className="manuscript-toolbar">
            {isAuthenticated && collections.length > 0 ? (
              <>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="manuscript-select"
                >
                  {collections.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
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
              <button type="button" className="manuscript-toolbar-btn is-danger" onClick={deletePost}>
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
            <span className="manuscript-flourish" aria-hidden="true">✒</span>
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
              <Link to="/login" className="manuscript-author-link">Sign in</Link> to leave a letter.
            </p>
          )}

          <div className="comment-list">
            {(post.comments || []).map((c) => {
              const isAnonComment = c.isAnonymous;
              const commenterId = c.userId?._id || c.userId;
              const commenterName = isAnonComment ? "Anonymous" : c.userId?.username || "Writer";
              const commenterAvatar = !isAnonComment ? c.userId?.avatarUrl : null;
              const canDeleteComment =
                user?.id &&
                (canEdit ||
                  (commenterId && commenterId.toString() === user.id));

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
                      {isAnonComment && (
                        <span className="manuscript-anon-tag">anonymous</span>
                      )}
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
