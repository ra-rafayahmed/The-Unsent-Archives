import { Link } from "react-router-dom";
import { getPostTextStyle } from "../../utils/postStyle";

const VARIANTS = ["polaroid", "tape", "clip", "letter"];

const pickVariant = (post, variantSeed) => {
  if (typeof variantSeed === "number") return VARIANTS[variantSeed % VARIANTS.length];
  const id = String(post?._id || "");
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return VARIANTS[h % VARIANTS.length];
};

const tiltFor = (post, variantSeed) => {
  const id = String(post?._id || "") + String(variantSeed ?? "");
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) >>> 0;
  // tilt between -1.4 and 1.4 deg
  return ((h % 28) - 14) / 10;
};

const NoteCard = ({
  post,
  canDelete = false,
  canEdit = false,
  onDelete,
  deleteLabel = "Delete",
  variantSeed,
}) => {
  const authorName = post?.isAnonymous ? "Anonymous" : post?.authorId?.username || "Unknown";
  const authorId = post?.authorId?._id;
  const image = post?.media?.find((m) => m.type === "image");
  const audio = post?.media?.find((m) => m.type === "audio");
  const textStyle = getPostTextStyle(post?.style || {});
  const variant = pickVariant(post, variantSeed);
  const tilt = tiltFor(post, variantSeed);
  const firstTag = (post?.tagSlugs || [])[0];
  const recReason = post?._recReason;
  const recLabel = {
    "tag-match": "Matches your tags",
    "collaborative-filter": "Readers like you",
    trending: "Trending now",
    "follow-network": "From who you follow",
  }[recReason];

  return (
    <article className={`note-card note-card-${variant}`} style={{ "--tilt": `${tilt}deg` }}>
      {recLabel ? <span className={`rec-badge rec-${recReason}`}>{recLabel}</span> : null}

      {variant === "tape" && (
        <>
          <span className="deco-tape deco-tape-tl" aria-hidden="true" />
          <span className="deco-tape deco-tape-tr" aria-hidden="true" />
        </>
      )}
      {variant === "clip" && <span className="deco-clip" aria-hidden="true" />}
      {variant === "polaroid" && <span className="deco-tape deco-tape-tc" aria-hidden="true" />}

      {image && (
        <div className="note-card-image" style={{ backgroundImage: `url(${image.url})` }}>
          <div className="image-overlay" />
          {firstTag && <span className="image-tag">#{firstTag}</span>}
        </div>
      )}

      <div
        className="note-card-content"
        style={{ background: post?.style?.background || undefined }}
      >
        <p className="note-text" style={textStyle}>
          {post.content}
        </p>

        {audio && <p className="note-audio">♪ Listening: {audio.url}</p>}

        {!image && (
          <div className="chip-row">
            {(post.tagSlugs || []).slice(0, 4).map((tag) => (
              <span key={tag} className="chip">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <footer className="note-meta">
          {authorId && !post?.isAnonymous ? (
            <Link to={`/profile/${authorId}`} className="author-link">
              <span className="author-handle">@{authorName}</span>
            </Link>
          ) : (
            <span className="author-handle">{authorName}</span>
          )}
          <span className="meta-dot" aria-hidden="true">
            ·
          </span>
          <span>{post.reactionCount || 0} hearts</span>
          <span className="meta-dot" aria-hidden="true">
            ·
          </span>
          <span>{post.viewCount || 0} reads</span>
          <Link to={`/posts/${post._id}`} className="note-bookmark" aria-label="Open">
            ✦
          </Link>
        </footer>

        {(canEdit || canDelete) && (
          <div className="row-inline note-actions">
            <Link to={`/posts/${post._id}`} className="ghost-btn small">
              Read
            </Link>
            {canEdit ? (
              <Link to={`/write/${post._id}`} className="ghost-btn small">
                Edit
              </Link>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="ghost-btn small"
                onClick={() => onDelete?.(post._id)}
              >
                {deleteLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
};

export default NoteCard;
