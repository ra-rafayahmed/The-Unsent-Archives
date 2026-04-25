import { Link } from "react-router-dom";

const NoteCard = ({ post }) => {
  const authorName = post?.isAnonymous ? "Anonymous" : post?.authorId?.username || "Unknown";
  const image = post?.media?.find((m) => m.type === "image");
  const audio = post?.media?.find((m) => m.type === "audio");

  return (
    <article className="note-card">
      {image && (
        <div className="note-card-image" style={{ backgroundImage: `url(${image.url})` }}>
          <div className="image-overlay" />
        </div>
      )}

      <div className="note-card-content">
        <p className="note-text">{post.content}</p>

        {audio && <p className="note-audio">Listening: {audio.url}</p>}

        <div className="chip-row">
          {(post.tagSlugs || []).slice(0, 4).map((tag) => (
            <span key={tag} className="chip">#{tag}</span>
          ))}
        </div>

        <footer className="note-meta">
          <span>{authorName}</span>
          <span>{post.reactionCount || 0} hearts</span>
          <span>{post.viewCount || 0} reads</span>
        </footer>

        <Link to={`/posts/${post._id}`} className="ghost-btn small">Read</Link>
      </div>
    </article>
  );
};

export default NoteCard;
