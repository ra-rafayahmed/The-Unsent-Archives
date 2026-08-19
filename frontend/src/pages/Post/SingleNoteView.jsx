import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { getPostTextStyle } from "../../utils/postStyle";
import ReportDialog from "../../components/ReportDialog";
import NoteComments from "../../components/post/NoteComments";
import NoteHeader from "../../components/post/NoteHeader";
import NoteReactions from "../../components/post/NoteReactions";
import NoteToolbar from "../../components/post/NoteToolbar";
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
        <NoteHeader
          authorId={visibleAuthorId}
          authorName={visibleAuthorName}
          viewerId={user?.id}
          isFollowing={isFollowing}
          isFollowLoading={isFollowLoading}
          onToggleFollow={toggleFollow}
        />

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

        <NoteReactions reactions={reactions} onReact={react} />

        <NoteToolbar
          postId={post._id}
          isAuthenticated={isAuthenticated}
          canEdit={canEdit}
          canDelete={canDelete}
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={setSelectedCollectionId}
          onSave={saveToCollection}
          onDelete={deletePost}
          onReport={() => setReporting(true)}
        />

        {status ? <p className="manuscript-flash">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <NoteComments
          comments={post.comments || []}
          isAuthenticated={isAuthenticated}
          viewerId={user?.id}
          canModerate={canEdit}
          draft={commentsText}
          onDraftChange={setCommentsText}
          isAnonymous={commentAnon}
          onAnonymousChange={setCommentAnon}
          onSubmit={comment}
          onDelete={deleteCommentById}
        />
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
